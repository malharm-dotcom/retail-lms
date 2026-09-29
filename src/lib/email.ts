import nodemailer from "nodemailer";
import { todayInIst } from "./dashboard";
import { prisma } from "./db";
import { formatDate } from "./text";

export function emailEnabled(): boolean {
  return process.env.EMAIL_ENABLED === "true";
}

function appUrl(path: string): string {
  return `${(process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")}${path}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function layout(heading: string, lines: string[], link: string, cta: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;color:#20231f">
<p style="font-size:11px;letter-spacing:2px;color:#a8462a;font-weight:bold">SNITCH RETAIL LEARNING</p>
<h2 style="font-family:Georgia,serif;font-weight:normal">${escapeHtml(heading)}</h2>
${lines.map((line) => `<p style="line-height:1.5">${escapeHtml(line)}</p>`).join("")}
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#a8462a;color:#fff;padding:12px 18px;text-decoration:none">${escapeHtml(cta)}</a></p>
</div>`;
}

type Recipient = { email: string | null; name: string };
type ModuleRef = { title: string; mandatory: boolean; dueDate: Date | null };

/** Queue "new learning assigned" mails. No-op while email is disabled, so no backlog floods out later. */
export async function queueAssignmentEmails(users: Recipient[], module: ModuleRef) {
  if (!emailEnabled()) return 0;
  const rows = users
    .filter((user) => user.email)
    .map((user) => ({
      recipient: user.email!,
      subject: `New ${module.mandatory ? "mandatory " : ""}learning: ${module.title}`,
      htmlBody: layout(
        `Hi ${user.name.split(" ")[0]}, you have new learning.`,
        [
          `“${module.title}” has been assigned to you${module.mandatory ? " and is mandatory" : ""}.`,
          module.dueDate ? `Please complete it by ${formatDate(module.dueDate)}.` : "Complete it at your convenience.",
        ],
        appUrl("/learn"),
        "Open my learning",
      ),
    }));
  if (rows.length) await prisma().emailOutbox.createMany({ data: rows });
  return rows.length;
}

/**
 * Email each person their employee code and temporary password, then send straight away
 * (the cron job retries failures). The password is single-use: first sign-in forces a change.
 * Returns the employee codes that were queued.
 */
export async function sendSignInDetails(people: { email: string | null; name: string; employeeCode: string; password: string }[]) {
  if (!emailEnabled()) return new Set<string>();
  const withEmail = people.filter((person) => person.email);
  if (withEmail.length === 0) return new Set<string>();
  await prisma().emailOutbox.createMany({
    data: withEmail.map((person) => ({
      recipient: person.email!,
      subject: "Your Snitch Learning sign-in details",
      htmlBody: layout(
        `Hi ${person.name.split(" ")[0]}, your learning account is ready.`,
        [
          `Employee code: ${person.employeeCode}`,
          `Temporary password: ${person.password}`,
          "You will choose your own password the first time you sign in. Do not share these details.",
        ],
        appUrl("/login"),
        "Sign in",
      ),
    })),
  });
  await deliverOutbox(withEmail.length + 50).catch(() => undefined);
  return new Set(withEmail.map((person) => person.employeeCode));
}

/** Remind learners with incomplete mandatory work due within 3 days or overdue, at most every 3 days. */
export async function queueDueReminders(now = new Date()) {
  if (!emailEnabled()) return 0;
  const today = todayInIst(now);
  const horizon = new Date(`${today}T00:00:00.000Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 3);
  const remindedBefore = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const due = await prisma().enrollment.findMany({
    where: {
      status: { not: "COMPLETED" },
      user: { active: true, email: { not: null } },
      assignment: { mandatory: true, dueDate: { not: null, lte: horizon } },
      OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: remindedBefore } }],
    },
    include: { user: true, assignment: { include: { moduleVersion: true } } },
    take: 500,
  });

  for (const enrollment of due) {
    const dueDate = enrollment.assignment.dueDate!;
    const overdue = dueDate.toISOString().slice(0, 10) < today;
    await prisma().$transaction([
      prisma().emailOutbox.create({
        data: {
          recipient: enrollment.user.email!,
          subject: `${overdue ? "Overdue" : "Due soon"}: ${enrollment.assignment.moduleVersion.title}`,
          htmlBody: layout(
            overdue ? "Your mandatory learning is overdue." : "Your mandatory learning is due soon.",
            [`“${enrollment.assignment.moduleVersion.title}” ${overdue ? "was" : "is"} due on ${formatDate(dueDate)}.`],
            appUrl(`/learn/${enrollment.id}`),
            "Continue learning",
          ),
        },
      }),
      prisma().enrollment.update({ where: { id: enrollment.id }, data: { lastReminderAt: now } }),
    ]);
  }
  return due.length;
}

/** Send pending outbox rows. Failed sends back off exponentially and stop after 5 attempts. */
export async function deliverOutbox(batchSize = 50) {
  if (!emailEnabled()) return { sent: 0, failed: 0 };
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });

  const pending = await prisma().emailOutbox.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  let sent = 0;
  let failed = 0;
  for (const mail of pending) {
    try {
      await transport.sendMail({ from: process.env.SMTP_FROM, to: mail.recipient, subject: mail.subject, html: mail.htmlBody });
      await prisma().emailOutbox.update({ where: { id: mail.id }, data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 } } });
      sent++;
    } catch (error) {
      const attempts = mail.attempts + 1;
      await prisma().emailOutbox.update({
        where: { id: mail.id },
        data: {
          attempts,
          status: attempts >= 5 ? "FAILED" : "PENDING",
          nextAttemptAt: new Date(Date.now() + 2 ** attempts * 60_000),
          lastError: error instanceof Error ? error.message.slice(0, 500) : String(error),
        },
      });
      failed++;
    }
  }
  return { sent, failed };
}

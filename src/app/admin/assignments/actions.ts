"use server";

import { revalidatePath } from "next/cache";
import { attempt, text, type ActionResult } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { todayInIst } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { queueAssignmentEmails } from "@/lib/email";
import { enrollAudience } from "@/lib/learning";
import { requireAdmin } from "@/lib/session";

type Target = "ALL_EMPLOYEES" | "STORE" | "DEPARTMENT" | "INDIVIDUAL";

export async function createAssignment(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  return attempt(async () => {
    const version = await prisma().moduleVersion.findUnique({
      where: { id: text(formData, "moduleVersionId") },
      include: { module: true },
    });
    if (!version || version.status !== "PUBLISHED" || version.module.status === "ARCHIVED")
      throw new Error("Choose a published module.");

    const target = text(formData, "target") as Target;
    if (!["ALL_EMPLOYEES", "STORE", "DEPARTMENT", "INDIVIDUAL"].includes(target)) throw new Error("Choose who should take it.");

    const due = text(formData, "dueDate");
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error("Due date is not valid.");
    if (due && due < todayInIst()) throw new Error("Due date cannot be in the past.");
    const mandatory = formData.get("mandatory") === "on";

    const base = {
      moduleVersionId: version.id,
      mandatory,
      dueDate: due ? new Date(`${due}T00:00:00.000Z`) : null,
      createdById: user.id,
    };

    let assignments: { id: string }[] = [];
    if (target === "INDIVIDUAL") {
      const codes = [...new Set(text(formData, "employeeCodes").toUpperCase().split(/[\s,;]+/).filter(Boolean))];
      if (codes.length === 0) throw new Error("Enter at least one employee code.");
      const people = await prisma().user.findMany({ where: { employeeCode: { in: codes }, active: true }, select: { id: true, employeeCode: true } });
      const missing = codes.filter((code) => !people.some((person) => person.employeeCode === code));
      if (missing.length) throw new Error(`No active employee with code: ${missing.join(", ")}.`);
      assignments = await prisma().assignment.createManyAndReturn({
        data: people.map((person) => ({ ...base, target, targetUserId: person.id })),
        select: { id: true },
      });
    } else {
      const storeId = target === "STORE" ? text(formData, "storeId") : null;
      const departmentId = target === "DEPARTMENT" ? text(formData, "departmentId") : null;
      if (target === "STORE" && !storeId) throw new Error("Choose a store.");
      if (target === "DEPARTMENT" && !departmentId) throw new Error("Choose a department.");
      assignments = [await prisma().assignment.create({ data: { ...base, target, storeId, departmentId }, select: { id: true } })];
    }

    const enrolledIds = (await Promise.all(assignments.map((row) => enrollAudience(row.id)))).flat();
    const learners = await prisma().user.findMany({ where: { id: { in: enrolledIds } }, select: { email: true, name: true } });
    const mailed = await queueAssignmentEmails(learners, { title: version.title, mandatory, dueDate: base.dueDate });

    for (const row of assignments) {
      await audit(user, "assignment.created", "Assignment", row.id, { module: version.title, version: version.version, target, due, mandatory });
    }
    revalidatePath("/admin", "layout");
    const skipped = enrolledIds.length === 0 ? " Everyone in this audience already has this module." : "";
    return `Assigned to ${enrolledIds.length} ${enrolledIds.length === 1 ? "person" : "people"}.${mailed ? ` ${mailed} email(s) queued.` : ""}${skipped}`;
  });
}

export async function syncAudience(formData: FormData) {
  const user = await requireAdmin();
  const assignmentId = text(formData, "assignmentId");
  const added = await enrollAudience(assignmentId);
  if (added.length) await audit(user, "assignment.synced", "Assignment", assignmentId, { added: added.length });
  revalidatePath("/admin", "layout");
}

export async function updateDueDate(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  return attempt(async () => {
    const assignmentId = text(formData, "assignmentId");
    const due = text(formData, "dueDate");
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error("Due date is not valid.");
    await prisma().assignment.update({
      where: { id: assignmentId },
      data: { dueDate: due ? new Date(`${due}T00:00:00.000Z`) : null, mandatory: formData.get("mandatory") === "on" },
    });
    await audit(user, "assignment.updated", "Assignment", assignmentId, { due, mandatory: formData.get("mandatory") === "on" });
    revalidatePath("/admin", "layout");
    return "Updated.";
  });
}

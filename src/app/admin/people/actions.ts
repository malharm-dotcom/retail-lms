"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { attempt, requiredText, text, type ActionResult } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { generateTemporaryPassword } from "@/lib/credentials";
import { prisma } from "@/lib/db";
import { enrollIntoOpenAssignments } from "@/lib/learning";
import { upsertPeople, validatePeople, type IssuedCredential, type PersonInput } from "@/lib/people";
import { requireAdmin } from "@/lib/session";
import { parseCsvRecords } from "@/lib/text";

export type ImportResult = {
  error?: string;
  problems?: string[];
  ok?: string;
  credentials?: IssuedCredential[];
} | null;

async function applyPeople(rows: PersonInput[]): Promise<ImportResult> {
  const actor = await requireAdmin();
  if (rows.length === 0) return { error: "No rows found." };
  if (rows.length > 5000) return { error: "Import at most 5,000 rows at a time." };
  const problems = validatePeople(rows, actor.role);
  if (problems.length) return { error: "Nothing was imported. Fix these rows and upload again:", problems: problems.slice(0, 60) };

  try {
    const result = await upsertPeople(rows, actor);
    await enrollIntoOpenAssignments(result.touched);
    await audit(actor, "people.imported", "User", "bulk", { created: result.created, updated: result.updated });
    revalidatePath("/admin", "layout");
    return {
      ok: `${result.created} added, ${result.updated} updated.`,
      credentials: result.credentials,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Import failed." };
  }
}

export async function importPeople(_previous: ImportResult, formData: FormData): Promise<ImportResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file." };
  if (file.size > 2 * 1024 * 1024) return { error: "CSV must be under 2 MB." };
  const rows = parseCsvRecords(await file.text());
  if (rows.length && !("employee_code" in rows[0] && "name" in rows[0]))
    return { error: "The CSV needs at least the columns employee_code and name. Download the template to see the format." };
  return applyPeople(rows);
}

export async function addPerson(_previous: ImportResult, formData: FormData): Promise<ImportResult> {
  const row: PersonInput = Object.fromEntries(
    ["employee_code", "name", "email", "store_code", "store_name", "department_code", "department_name", "role"].map((key) => [key, text(formData, key)]),
  );
  const existing = await prisma().user.count({ where: { employeeCode: (row.employee_code ?? "").toUpperCase() } });
  if (existing) return { error: `${row.employee_code?.toUpperCase()} already exists. Open their record to edit it.` };
  return applyPeople([row]);
}

async function editableTarget(userId: string) {
  const actor = await requireAdmin();
  const target = await prisma().user.findUnique({ where: { id: userId } });
  if (!target) throw new Error("Employee not found.");
  if (target.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") throw new Error("Only a super admin can change a super admin.");
  return { actor, target };
}

export async function updatePerson(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const { actor, target } = await editableTarget(text(formData, "userId"));
    const role = (text(formData, "role") || target.role) as typeof target.role;
    if (role !== target.role) {
      if (target.id === actor.id) throw new Error("You cannot change your own role.");
      if (role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") throw new Error("Only a super admin can grant super admin.");
    }
    const email = text(formData, "email").toLowerCase() || null;
    if (email) {
      const owner = await prisma().user.findFirst({ where: { email, id: { not: target.id } }, select: { employeeCode: true } });
      if (owner) throw new Error(`That email belongs to ${owner.employeeCode}.`);
    }
    const data = {
      name: requiredText(formData, "name", "Name"),
      email,
      role,
      storeId: text(formData, "storeId") || null,
      departmentId: text(formData, "departmentId") || null,
    };
    await prisma().user.update({ where: { id: target.id }, data });
    if (data.storeId !== target.storeId || data.departmentId !== target.departmentId) await enrollIntoOpenAssignments([target.id]);
    await audit(actor, "user.updated", "User", target.id, { ...data, previousRole: target.role });
    revalidatePath("/admin", "layout");
    return "Saved.";
  });
}

export async function setActive(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const { actor, target } = await editableTarget(text(formData, "userId"));
    const active = text(formData, "active") === "true";
    if (target.id === actor.id) throw new Error("You cannot deactivate yourself.");
    await prisma().user.update({ where: { id: target.id }, data: { active } });
    if (active) await enrollIntoOpenAssignments([target.id]);
    await audit(actor, active ? "user.reactivated" : "user.deactivated", "User", target.id);
    revalidatePath("/admin", "layout");
    return active ? "Reactivated. They can sign in again." : "Deactivated. They can no longer sign in; their history is kept.";
  });
}

export async function resetPassword(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const { actor, target } = await editableTarget(text(formData, "userId"));
    if (target.id === actor.id) throw new Error("Use Change password for your own account.");
    const password = generateTemporaryPassword();
    await prisma().user.update({ where: { id: target.id }, data: { passwordHash: await hash(password, 10), forcePasswordChange: true } });
    await audit(actor, "user.password_reset", "User", target.id);
    return `Temporary password for ${target.employeeCode}: ${password} — share it privately. It is shown only once; they must change it at sign-in.`;
  });
}

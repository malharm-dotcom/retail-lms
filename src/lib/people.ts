import { hash } from "bcryptjs";
import type { Role } from "@/generated/prisma/client";
import { generateTemporaryPassword, normalizeEmployeeCode } from "./credentials";
import { prisma } from "./db";

export const PEOPLE_CSV_HEADER = ["employee_code", "name", "email", "store_code", "store_name", "department_code", "department_name", "role"];

export type PersonInput = {
  employee_code?: string;
  name?: string;
  email?: string;
  store_code?: string;
  store_name?: string;
  department_code?: string;
  department_name?: string;
  role?: string;
};

export type IssuedCredential = { employeeCode: string; name: string; password: string; email: string | null; emailed?: boolean };

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_\-/.]{1,31}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validate every row first; returns problems keyed by CSV line number (header is line 1). */
export function validatePeople(rows: PersonInput[], actorRole: Role): string[] {
  const problems: string[] = [];
  const seenCodes = new Map<string, number>();
  const seenEmails = new Map<string, number>();
  rows.forEach((row, index) => {
    const line = index + 2;
    const code = normalizeEmployeeCode(row.employee_code ?? "");
    const email = (row.email ?? "").trim().toLowerCase();
    const role = (row.role ?? "").trim().toUpperCase() || "EMPLOYEE";
    if (!CODE_PATTERN.test(code)) problems.push(`Line ${line}: employee code “${row.employee_code ?? ""}” is missing or invalid.`);
    if (!(row.name ?? "").trim()) problems.push(`Line ${line}: name is missing.`);
    if (email && !EMAIL_PATTERN.test(email)) problems.push(`Line ${line}: email “${row.email}” is not valid.`);
    if (!["EMPLOYEE", "HR_ADMIN", "SUPER_ADMIN"].includes(role)) problems.push(`Line ${line}: role must be EMPLOYEE or HR_ADMIN.`);
    if (role === "SUPER_ADMIN" && actorRole !== "SUPER_ADMIN") problems.push(`Line ${line}: only a super admin can grant SUPER_ADMIN.`);
    if (code && seenCodes.has(code)) problems.push(`Line ${line}: employee code ${code} repeats line ${seenCodes.get(code)}.`);
    if (email && seenEmails.has(email)) problems.push(`Line ${line}: email repeats line ${seenEmails.get(email)}.`);
    seenCodes.set(code, line);
    if (email) seenEmails.set(email, line);
  });
  return problems;
}

async function upsertByCode(kind: "store" | "department", code: string | undefined, name: string | undefined, cache: Map<string, string>) {
  const key = normalizeEmployeeCode(code ?? "");
  if (!key) return undefined;
  if (cache.has(key)) return cache.get(key);
  const label = (name ?? "").trim();
  const model = prisma()[kind] as unknown as {
    upsert: (args: object) => Promise<{ id: string }>;
  };
  const row = await model.upsert({
    where: { code: key },
    update: label ? { name: label, active: true } : { active: true },
    create: { code: key, name: label || key },
  });
  cache.set(key, row.id);
  return row.id;
}

/**
 * Create or update people. New people get a random temporary password (returned once, never stored
 * in plain text). Existing people keep their password. Returns ids that need enrolment into open
 * group assignments.
 */
export async function upsertPeople(rows: PersonInput[], actor: { role: Role }) {
  const stores = new Map<string, string>();
  const departments = new Map<string, string>();
  const credentials: IssuedCredential[] = [];
  const touched: string[] = [];
  let created = 0;
  let updated = 0;

  const codes = rows.map((row) => normalizeEmployeeCode(row.employee_code ?? ""));
  const existing = new Map(
    (await prisma().user.findMany({ where: { employeeCode: { in: codes } } })).map((user) => [user.employeeCode, user]),
  );

  const emails = rows.map((row) => (row.email ?? "").trim().toLowerCase()).filter(Boolean);
  const emailOwners = new Map(
    (await prisma().user.findMany({ where: { email: { in: emails } }, select: { email: true, employeeCode: true } })).map((user) => [
      user.email!,
      user.employeeCode,
    ]),
  );
  for (const [index, row] of rows.entries()) {
    const email = (row.email ?? "").trim().toLowerCase();
    const owner = email ? emailOwners.get(email) : undefined;
    if (owner && owner !== codes[index]) throw new Error(`Line ${index + 2}: email ${email} already belongs to ${owner}.`);
    const current = existing.get(codes[index]);
    if (current?.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN")
      throw new Error(`Line ${index + 2}: ${codes[index]} is a super admin and can only be changed by a super admin.`);
  }

  for (const [index, row] of rows.entries()) {
    const code = codes[index];
    const storeId = await upsertByCode("store", row.store_code, row.store_name, stores);
    const departmentId = await upsertByCode("department", row.department_code, row.department_name, departments);
    const role = ((row.role ?? "").trim().toUpperCase() || "EMPLOYEE") as Role;
    const data = {
      name: row.name!.trim(),
      email: (row.email ?? "").trim().toLowerCase() || null,
      role,
      ...(storeId !== undefined ? { storeId } : {}),
      ...(departmentId !== undefined ? { departmentId } : {}),
    };

    const current = existing.get(code);
    if (current) {
      await prisma().user.update({ where: { id: current.id }, data });
      updated++;
      if (current.storeId !== (storeId ?? current.storeId) || current.departmentId !== (departmentId ?? current.departmentId) || !current.active)
        touched.push(current.id);
    } else {
      const password = generateTemporaryPassword();
      // ponytail: cost 10 keeps 1,000-row imports under a minute; the password is single-use anyway.
      const user = await prisma().user.create({
        data: { ...data, employeeCode: code, passwordHash: await hash(password, 10), forcePasswordChange: true },
      });
      credentials.push({ employeeCode: code, name: user.name, password, email: user.email });
      touched.push(user.id);
      created++;
    }
  }

  return { created, updated, credentials, touched };
}

import { compare } from "bcryptjs";
import { randomInt } from "node:crypto";

const DUMMY_HASH = "$2b$12$TwrLahoaOwvKm5xinfMr.eVCR04ta8c2mRPywenizoN4oMSgXXJfy";

export function normalizeEmployeeCode(value: string): string {
  return value.trim().toUpperCase();
}

export async function verifyCredentials(
  user: { active: boolean; passwordHash: string } | null,
  password: string,
): Promise<boolean> {
  const passwordMatches = await compare(password, user?.passwordHash ?? DUMMY_HASH);
  return Boolean(user?.active && passwordMatches);
}

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Readable temporary password (no 0/O, 1/l/I). Employees must replace it at first sign-in. */
export function generateTemporaryPassword(length = 10): string {
  return Array.from({ length }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join("");
}

export function passwordProblem(password: string, employeeCode: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use both letters and numbers.";
  if (password.toUpperCase().includes(employeeCode.toUpperCase())) return "Do not include your employee code.";
  return null;
}

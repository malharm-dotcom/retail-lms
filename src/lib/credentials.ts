import { compare } from "bcryptjs";

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


import type { Role } from "@/generated/prisma/client";

export function canAccessAdmin(role: Role): boolean {
  return role === "HR_ADMIN" || role === "SUPER_ADMIN";
}

export function homeForRole(role: Role): "/admin" | "/learn" {
  return canAccessAdmin(role) ? "/admin" : "/learn";
}


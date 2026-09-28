import type { Prisma } from "@/generated/prisma/client";

export const assignmentAudienceInclude = {
  store: { select: { name: true } },
  department: { select: { name: true } },
  targetUser: { select: { name: true, employeeCode: true } },
} satisfies Prisma.AssignmentInclude;

type AudienceRow = Prisma.AssignmentGetPayload<{ include: typeof assignmentAudienceInclude }>;

export function audienceLabel(assignment: AudienceRow): string {
  switch (assignment.target) {
    case "ALL_EMPLOYEES":
      return "All employees";
    case "STORE":
      return `Store · ${assignment.store?.name ?? "—"}`;
    case "DEPARTMENT":
      return `Dept · ${assignment.department?.name ?? "—"}`;
    case "INDIVIDUAL":
      return assignment.targetUser ? `${assignment.targetUser.name} (${assignment.targetUser.employeeCode})` : "Individual";
  }
}

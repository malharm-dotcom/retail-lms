import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";

type Actor = { id: string; employeeCode: string };
type Db = Pick<ReturnType<typeof prisma>, "auditEvent">;

export async function audit(
  actor: Actor,
  action: string,
  targetType: string,
  targetId: string,
  diff?: Prisma.InputJsonValue,
  db: Db = prisma(),
) {
  await db.auditEvent.create({
    data: { actorId: actor.id, actorEmployeeCode: actor.employeeCode, action, targetType, targetId, diff },
  });
}

const ACTION_LABELS: Record<string, string> = {
  "module.created": "Created module",
  "module.draft_updated": "Edited draft details",
  "module.published": "Published module",
  "module.draft_created": "Started new version",
  "module.draft_discarded": "Discarded draft",
  "module.deleted": "Deleted module",
  "module.archived": "Archived module",
  "module.restored": "Restored module",
  "lesson.created": "Added lesson",
  "lesson.updated": "Edited lesson",
  "lesson.deleted": "Deleted lesson",
  "asset.uploaded": "Uploaded PDF",
  "assignment.created": "Assigned module",
  "assignment.updated": "Changed deadline",
  "assignment.synced": "Enrolled missing people",
  "people.imported": "Imported people",
  "user.updated": "Edited person",
  "user.deactivated": "Deactivated person",
  "user.reactivated": "Reactivated person",
  "user.password_reset": "Reset password",
  "user.password_changed": "Changed own password",
  "people.passwords_issued": "Issued temporary passwords",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

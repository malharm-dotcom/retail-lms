import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { buildAuthOptions } from "./auth";
import { prisma } from "./db";
import { canAccessAdmin } from "./rbac";

export async function currentUserOrNull() {
  const session = await getServerSession(buildAuthOptions());
  if (!session?.user?.id) return null;

  const user = await prisma().user.findUnique({
    where: { id: session.user.id },
    include: { store: true, department: true },
  });

  return user?.active ? user : null;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof currentUserOrNull>>>;

/** Pages: signed-in users only; users holding a temporary password must change it first. */
export async function requireCurrentUser(options: { allowTemporaryPassword?: boolean } = {}) {
  const user = await currentUserOrNull();
  if (!user) redirect("/login");
  if (user.forcePasswordChange && !options.allowTemporaryPassword) redirect("/account/password");
  return user;
}

export async function requireAdminPage() {
  const user = await requireCurrentUser();
  if (!canAccessAdmin(user.role)) redirect("/learn");
  return user;
}

/** Server actions and route handlers: throw instead of redirecting. */
export async function requireAdmin() {
  const user = await currentUserOrNull();
  if (!user || !canAccessAdmin(user.role) || user.forcePasswordChange) throw new Error("Not authorised");
  return user;
}

export async function requireLearner() {
  const user = await currentUserOrNull();
  if (!user || user.forcePasswordChange) throw new Error("Not authorised");
  return user;
}

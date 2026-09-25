import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { buildAuthOptions } from "./auth";
import { prisma } from "./db";

export async function currentUserOrNull() {
  const session = await getServerSession(buildAuthOptions());
  if (!session?.user?.id) return null;

  const user = await prisma().user.findUnique({
    where: { id: session.user.id },
    include: { store: true, department: true },
  });

  return user?.active ? user : null;
}

export async function requireCurrentUser() {
  const user = await currentUserOrNull();
  if (!user) redirect("/login");
  return user;
}


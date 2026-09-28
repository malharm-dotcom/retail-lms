"use server";

import { compare, hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { attempt, text, type ActionResult } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { passwordProblem } from "@/lib/credentials";
import { prisma } from "@/lib/db";
import { homeForRole } from "@/lib/rbac";
import { currentUserOrNull } from "@/lib/session";

export async function changePassword(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await currentUserOrNull();
  if (!user) redirect("/login");

  const result = await attempt(async () => {
    const current = text(formData, "current");
    const next = String(formData.get("next") ?? "");
    const confirm = String(formData.get("confirm") ?? "");

    if (!(await compare(current, user.passwordHash))) throw new Error("Your current password is incorrect.");
    if (next !== confirm) throw new Error("The new passwords do not match.");
    if (next === current) throw new Error("Choose a password different from the current one.");
    const problem = passwordProblem(next, user.employeeCode);
    if (problem) throw new Error(problem);

    await prisma().user.update({
      where: { id: user.id },
      data: { passwordHash: await hash(next, 12), forcePasswordChange: false },
    });
    await audit(user, "user.password_changed", "User", user.id);
  });

  if (result?.ok) redirect(homeForRole(user.role));
  return result;
}

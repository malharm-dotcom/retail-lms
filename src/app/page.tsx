import { redirect } from "next/navigation";
import { homeForRole } from "@/lib/rbac";
import { requireCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireCurrentUser();
  redirect(homeForRole(user.role));
}

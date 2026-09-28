import Link from "next/link";
import type { Role } from "@/generated/prisma/client";
import { canAccessAdmin } from "@/lib/rbac";
import { SignOutButton } from "./sign-out-button";

type AppShellProps = {
  children: React.ReactNode;
  user: { name: string; employeeCode: string; role: Role };
  active: "learn" | "admin";
};

export function AppShell({ children, user, active }: AppShellProps) {
  const admin = canAccessAdmin(user.role);

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div>
          <Link className="brand" href={admin ? "/admin" : "/learn"}>
            <span>SNITCH RETAIL</span>
            <strong>Learning desk</strong>
          </Link>
          <nav aria-label="Primary navigation">
            <Link className={active === "learn" ? "active" : ""} href="/learn">
              My learning
            </Link>
            {admin ? (
              <Link className={active === "admin" ? "active" : ""} href="/admin">
                Admin overview
              </Link>
            ) : null}
            <span>Certificates <small>Soon</small></span>
            {admin ? <span>Content manager <small>Soon</small></span> : null}
          </nav>
        </div>
        <div className="sidebar-user">
          <span>{user.employeeCode}</span>
          <strong>{user.name}</strong>
          <small>{user.role.replace("_", " ")}</small>
          <SignOutButton />
        </div>
      </aside>
      <main className="workspace">{children}</main>
    </div>
  );
}

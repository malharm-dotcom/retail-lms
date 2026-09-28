import Link from "next/link";
import type { Role } from "@/generated/prisma/client";
import { canAccessAdmin } from "@/lib/rbac";
import { SignOutButton } from "./sign-out-button";

export type NavKey = "learn" | "admin" | "modules" | "assignments" | "people" | "reports" | "audit" | "account";

type AppShellProps = {
  children: React.ReactNode;
  user: { name: string; employeeCode: string; role: Role; store?: { name: string } | null };
  active: NavKey;
};

const ADMIN_NAV: { key: NavKey; href: string; label: string; index: string }[] = [
  { key: "admin", href: "/admin", label: "Overview", index: "01" },
  { key: "modules", href: "/admin/modules", label: "Modules", index: "02" },
  { key: "assignments", href: "/admin/assignments", label: "Assignments", index: "03" },
  { key: "people", href: "/admin/people", label: "People", index: "04" },
  { key: "reports", href: "/admin/reports", label: "Reports", index: "05" },
  { key: "audit", href: "/admin/audit", label: "Audit log", index: "06" },
  { key: "learn", href: "/learn", label: "My learning", index: "07" },
];

const LEARNER_NAV: typeof ADMIN_NAV = [{ key: "learn", href: "/learn", label: "My learning", index: "01" }];

export function AppShell({ children, user, active }: AppShellProps) {
  const admin = canAccessAdmin(user.role);
  const nav = admin ? ADMIN_NAV : LEARNER_NAV;

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div>
          <Link className="brand" href={admin ? "/admin" : "/learn"}>
            <span>SNITCH RETAIL</span>
            <strong>
              Learning <em>desk</em>
            </strong>
          </Link>
          <nav aria-label="Primary navigation">
            {nav.map((item) => (
              <Link key={item.key} className={active === item.key ? "active" : ""} href={item.href} aria-current={active === item.key ? "page" : undefined}>
                <small>{item.index}</small>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="sidebar-user">
          <span>{user.employeeCode}</span>
          <strong>{user.name}</strong>
          <small>{admin ? user.role.replace("_", " ") : (user.store?.name ?? "Employee")}</small>
          <div className="sidebar-links">
            <Link className={active === "account" ? "active" : ""} href="/account/password">
              Change password
            </Link>
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main className="workspace">{children}</main>
    </div>
  );
}

import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { canAccessAdmin } from "@/lib/rbac";

export default withAuth(
  function proxy(request) {
    const role = request.nextauth.token?.role;
    if (request.nextUrl.pathname.startsWith("/admin") && (!role || !canAccessAdmin(role))) {
      return NextResponse.redirect(new URL("/learn", request.url));
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: { authorized: ({ token }) => Boolean(token?.uid) },
  },
);

export const config = {
  matcher: ["/((?!api/auth|api/health|api/cron|login|_next/static|_next/image|favicon.ico).*)"],
};

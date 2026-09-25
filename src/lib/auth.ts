import type { Role } from "@/generated/prisma/client";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { normalizeEmployeeCode, verifyCredentials } from "./credentials";
import { prisma } from "./db";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      employeeCode: string;
      name: string;
      role: Role;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    employeeCode?: string;
    role?: Role;
  }
}

function sessionSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.APP_DEPLOY_ENV === "production") {
    throw new Error("NEXTAUTH_SECRET must contain at least 32 characters in production");
  }
  return "retail-lms-local-secret-change-before-production";
}

export function buildAuthOptions(): NextAuthOptions {
  return {
    secret: sessionSecret(),
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
    providers: [
      CredentialsProvider({
        name: "Employee code and password",
        credentials: {
          employeeCode: { label: "Employee code", type: "text" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const employeeCode = normalizeEmployeeCode(credentials?.employeeCode ?? "");
          const password = credentials?.password ?? "";
          if (!employeeCode || !password) return null;

          try {
            const user = await prisma().user.findUnique({ where: { employeeCode } });
            if (!(await verifyCredentials(user, password))) return null;

            return { id: user!.id, name: user!.name, email: user!.email ?? undefined };
          } catch (error) {
            console.error("[auth] credential verification failed", error instanceof Error ? error.message : error);
            return null;
          }
        },
      }),
    ],
    callbacks: {
      async jwt({ token, user }) {
        if (user?.id) token.uid = user.id;
        if (!token.uid) return token;

        const current = await prisma().user.findUnique({ where: { id: token.uid } });
        if (!current || !current.active) {
          delete token.uid;
          delete token.employeeCode;
          delete token.role;
          return token;
        }

        token.employeeCode = current.employeeCode;
        token.role = current.role;
        return token;
      },
      async session({ session, token }) {
        const current = token.uid
          ? await prisma().user.findUnique({ where: { id: token.uid } })
          : null;

        if (!current || !current.active) {
          session.user = undefined;
          return session;
        }

        session.user = {
          id: current.id,
          employeeCode: current.employeeCode,
          name: current.name,
          role: current.role,
        };
        return session;
      },
    },
  };
}


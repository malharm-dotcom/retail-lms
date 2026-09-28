import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Retail Learning Desk",
  description: "Employee learning and policy compliance",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

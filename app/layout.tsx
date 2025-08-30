// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import Providers from "./providers";

export const metadata = {
  title: "ICE ERP",
  description: "Google sign-in • Prisma • Postgres",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #eee",
            display: "flex",
            gap: 16,
          }}
        >
          <Link href="/">Home</Link>
          <Link href="/dictionaries">Dictionaries</Link>
          <Link href="/dashboard">Dashboard</Link>
        </header>

        <Providers>
          <main style={{ padding: "16px" }}>{children}</main>
        </Providers>
      </body>
    </html>
  );
}

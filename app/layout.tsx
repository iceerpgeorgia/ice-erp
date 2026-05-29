// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import Providers from "./providers";
import PageTitle from "./page-title";

export const metadata = {
  title: {
    template: "%s",
    default: "Home",
  },
  description: "Google sign-in • Prisma • Postgres",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <header className="flex h-topbar items-center gap-6 border-b border-border bg-card px-6 shadow-xs">
          <Link
            href="/"
            className="text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            Home
          </Link>
          <Link
            href="/dictionaries"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Dictionaries
          </Link>
        </header>

        <Providers>
          <PageTitle />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}

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
      <body className="font-sans text-[14px] text-neutral-950 antialiased">
        <header className="flex gap-4 px-4 py-3 border-b border-gray-200 bg-white">
          <Link href="/" className="text-blue-600 hover:underline">Home</Link>
          <Link href="/dictionaries" className="text-blue-600 hover:underline">Dictionaries</Link>
        </header>

        <Providers>
          <PageTitle />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}

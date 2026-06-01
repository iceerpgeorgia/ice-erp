// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";
import Providers from "./providers";
import { AppShell } from "./app-shell";

export const metadata = {
  title: {
    template: "%s | ICE ERP",
    default: "Home | ICE ERP",
  },
  description: "ICE ERP — Financial Management System",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}

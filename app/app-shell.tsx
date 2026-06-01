'use client';

import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User } from 'lucide-react';
import PageTitle from './page-title';

function Topbar() {
  const { data: session } = useSession();

  return (
    <header className="flex h-topbar shrink-0 items-center gap-3 border-b border-border bg-card px-4 shadow-xs">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />

      <div className="h-4 w-px bg-border" />

      {/* Dynamic page title */}
      <div className="flex-1 min-w-0">
        <PageTitle className="text-sm font-medium text-foreground truncate" />
      </div>

      {/* User menu */}
      {session?.user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-semibold">
                {(session.user.name ?? session.user.email ?? 'U')[0].toUpperCase()}
              </div>
              <span className="hidden sm:block max-w-[140px] truncate">
                {session.user.name ?? session.user.email}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-3 py-2">
              <p className="text-xs font-medium text-foreground truncate">{session.user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
              <LogOut className="h-3.5 w-3.5 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex flex-1 flex-col min-w-0 min-h-svh">
        <Topbar />
        <main className="flex-1 min-h-0">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}

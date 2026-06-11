'use client';

import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { NavConfigProvider } from '@/components/nav-config-context';
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
import { NavIconTitleSync } from '@/components/nav-icon-title-sync';
import { FloatingAIButton } from '@/components/troubleshooting/floating-ai-button';
import { usePathname } from 'next/navigation';

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
  const pathname = usePathname();
  
  // Extract page context from pathname
  const getPageContext = () => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return 'Dashboard';
    return parts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' / ');
  };

  return (
    <NavConfigProvider>
      <NavIconTitleSync />
      <SidebarProvider>
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0 min-h-svh">
          <Topbar />
          <main className="flex-1 min-h-0">
            {children}
          </main>
          {/* Floating AI Button */}
          <FloatingAIButton pageContext={getPageContext()} />
        </div>
      </SidebarProvider>
    </NavConfigProvider>
  );
}

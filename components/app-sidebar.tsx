'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Home,
  Landmark,
  ReceiptText,
  Wallet,
  FileBarChart2,
  BookOpen,
  ShieldCheck,
  ChevronsLeft,
  ChevronsRight,
  Layers2,
  ArrowLeftRight,
  ClipboardList,
  Users,
  Building2,
  Globe,
  Banknote,
  ListTree,
  Package,
  Scale,
  FileSpreadsheet,
  DollarSign,
  TrendingUp,
  BarChart3,
  UserCheck,
  Settings,
  PanelLeftClose,
} from 'lucide-react';
import { cn } from '@/components/ui/utils';

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  matchPrefix?: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const NAV: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Home', href: '/', icon: Home },
    ],
  },
  {
    title: 'Banking',
    items: [
      { label: 'Bank Transactions', href: '/dictionaries/bank-transactions', icon: Landmark, matchPrefix: '/dictionaries/bank-transactions' },
      { label: 'TX Batches', href: '/bank-transaction-batches', icon: Layers2 },
      { label: 'Waybills In', href: '/dictionaries/waybills', icon: ClipboardList },
      { label: 'Waybill Items', href: '/dictionaries/waybill-items', icon: ListTree },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Payments', href: '/dictionaries/payments', icon: Wallet },
      { label: 'Payments Ledger', href: '/dictionaries/payments-ledger', icon: ReceiptText },
      { label: 'Payment Redistribution', href: '/dictionaries/payment-redistribution', icon: ArrowLeftRight },
      { label: 'Salary Accruals', href: '/dictionaries/salary-accruals', icon: DollarSign },
      { label: 'NBG Rates', href: '/dictionaries/nbg-rates', icon: TrendingUp },
      { label: 'Conversions', href: '/dictionaries/conversions', icon: Scale },
    ],
  },
  {
    title: 'Reports',
    items: [
      { label: 'Payments Report', href: '/dictionaries/payments-report', icon: FileBarChart2 },
      { label: 'Projects Report', href: '/dictionaries/projects-report', icon: BarChart3 },
      { label: 'Services Report', href: '/dictionaries/services-report', icon: FileSpreadsheet },
    ],
  },
  {
    title: 'Dictionaries',
    items: [
      { label: 'Counteragents', href: '/dictionaries/counteragents', icon: UserCheck, matchPrefix: '/dictionaries/counteragents' },
      { label: 'Projects', href: '/admin/projects', icon: Building2 },
      { label: 'Jobs', href: '/dictionaries/jobs', icon: Layers2 },
      { label: 'Banks', href: '/dictionaries/banks', icon: Landmark },
      { label: 'Bank Accounts', href: '/dictionaries/bank-accounts', icon: Banknote },
      { label: 'Currencies', href: '/dictionaries/currencies', icon: Globe },
      { label: 'Countries', href: '/dictionaries/countries', icon: Globe, matchPrefix: '/dictionaries/countries' },
      { label: 'Entity Types', href: '/dictionaries/entity-types', icon: ListTree, matchPrefix: '/dictionaries/entity-types' },
      { label: 'Parsing Rules', href: '/dictionaries/parsing-scheme-rules', icon: Settings },
      { label: 'Inventories', href: '/dictionaries/inventories', icon: Package },
      { label: 'Dimensions', href: '/dictionaries/dimensions', icon: Scale },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Users', href: '/admin/users', icon: Users },
      { label: 'Financial Codes', href: '/admin/financial-codes', icon: BookOpen },
      { label: 'Attachments', href: '/admin/attachments', icon: FileSpreadsheet },
      { label: 'Document Types', href: '/admin/document-types', icon: ClipboardList },
      { label: 'Modules', href: '/admin/modules', icon: Layers2 },
      { label: 'Permissions', href: '/admin/permissions', icon: ShieldCheck },
      { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    ],
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.matchPrefix) return pathname.startsWith(item.matchPrefix);
  return pathname === item.href;
}

export function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      {/* Logo / App name */}
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary">
            <span className="text-xs font-bold text-sidebar-primary-foreground">IC</span>
          </div>
          {!collapsed && (
            <span className="truncate text-sm font-semibold text-sidebar-accent-foreground tracking-tight">
              ICE ERP
            </span>
          )}
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="py-2">
        {NAV.map((group) => (
          <SidebarGroup key={group.title} className="px-2">
            <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
              {group.title}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const active = isActive(pathname, item);
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      className={cn(
                        'group h-8 rounded-md px-2 text-[13px] font-medium transition-colors',
                        active
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      )}
                    >
                      <Link href={item.href}>
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-4 py-3">
        {!collapsed && (
          <p className="text-[10px] text-sidebar-foreground/40">
            © 2026 ICE ERP
          </p>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

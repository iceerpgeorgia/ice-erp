'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
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
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { useNavConfig } from '@/components/nav-config-context';
import { MASTER_NAV } from '@/lib/nav/master';
import { getIcon } from '@/lib/nav/icons';

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
  const { setOpen } = useSidebar();
  const { config } = useNavConfig();

  const handleNavClick = () => setOpen(false);

  // Build nav groups: dynamic if user has folders, otherwise static fallback
  const navGroups = useMemo<NavGroup[]>(() => {
    if (!config || config.folders.length === 0) return NAV;

    const itemsMap = Object.fromEntries(config.items.map(i => [i.routeKey, i]));

    // Map master items into folder buckets
    const grouped: Record<string, typeof MASTER_NAV> = {};
    const uncategorized: typeof MASTER_NAV = [];

    MASTER_NAV.forEach(master => {
      const override = itemsMap[master.routeKey];
      const folderId = override?.folderId ?? null;
      if (folderId) {
        if (!grouped[folderId]) grouped[folderId] = [];
        grouped[folderId].push(master);
      } else {
        uncategorized.push(master);
      }
    });

    const groups: NavGroup[] = [];

    // User-defined folders (only if they have items)
    for (const folder of config.folders) {
      const folderItems = grouped[folder.id];
      if (!folderItems?.length) continue;
      groups.push({
        title: folder.name,
        items: folderItems.map(m => ({
          label: m.label,
          href: m.routeKey,
          icon: getIcon(itemsMap[m.routeKey]?.icon ?? m.defaultIcon) as React.ElementType,
          matchPrefix: m.routeKey !== '/' ? m.routeKey : undefined,
        })),
      });
    }

    // Uncategorized items grouped by default group
    const byDefault: Record<string, typeof MASTER_NAV> = {};
    uncategorized.forEach(m => {
      if (!byDefault[m.defaultGroup]) byDefault[m.defaultGroup] = [];
      byDefault[m.defaultGroup].push(m);
    });
    const defaultGroupOrder = ['Overview', 'Banking', 'Finance', 'Reports', 'Dictionaries', 'Admin'];
    const sortedDefaultGroups = Object.keys(byDefault).sort(
      (a, b) => (defaultGroupOrder.indexOf(a) - defaultGroupOrder.indexOf(b))
    );
    for (const group of sortedDefaultGroups) {
      groups.push({
        title: group,
        items: byDefault[group].map(m => ({
          label: m.label,
          href: m.routeKey,
          icon: getIcon(itemsMap[m.routeKey]?.icon ?? m.defaultIcon) as React.ElementType,
          matchPrefix: m.routeKey !== '/' ? m.routeKey : undefined,
        })),
      });
    }

    return groups;
  }, [config]);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      {/* Logo / App name */}
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary">
            <span className="text-xs font-bold text-sidebar-primary-foreground">IC</span>
          </div>
          <span className="truncate text-sm font-semibold text-sidebar-accent-foreground tracking-tight group-data-[state=collapsed]:hidden">
            ICE ERP
          </span>
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="py-2">
        {navGroups.map((group) => (
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
                      <Link href={item.href} onClick={handleNavClick}>
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
        <p className="text-[10px] text-sidebar-foreground/40 group-data-[state=collapsed]:hidden">
          © 2026 ICE ERP
        </p>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

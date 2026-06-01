import Link from "next/link";
import {
  Landmark,
  Wallet,
  FileBarChart2,
  BookOpen,
  ClipboardList,
  Users,
  Globe,
  Banknote,
  ListTree,
  Package,
  Scale,
  ArrowLeftRight,
  DollarSign,
  TrendingUp,
  BarChart3,
  FileSpreadsheet,
  Settings,
  ShieldCheck,
  Layers2,
  Building2,
} from "lucide-react";

export const revalidate = 0;

type NavEntry = { label: string; href: string; icon: React.ElementType; desc?: string };
type Section = { title: string; color: string; items: NavEntry[] };

const SECTIONS: Section[] = [
  {
    title: "Banking",
    color: "bg-blue-50 text-blue-600",
    items: [
      { label: "Bank Transactions", href: "/dictionaries/bank-transactions", icon: Landmark, desc: "BOG/NBG statement import" },
      { label: "TX Batches", href: "/bank-transaction-batches", icon: Layers2, desc: "Batch payment processing" },
      { label: "Bank Accounts", href: "/dictionaries/bank-accounts", icon: Banknote, desc: "Account registry" },
      { label: "Banks", href: "/dictionaries/banks", icon: Building2, desc: "Bank reference data" },
      { label: "Parsing Rules", href: "/dictionaries/parsing-scheme-rules", icon: Settings, desc: "Transaction parsing logic" },
    ],
  },
  {
    title: "Waybills",
    color: "bg-amber-50 text-amber-600",
    items: [
      { label: "Waybills In", href: "/dictionaries/waybills", icon: ClipboardList, desc: "RS.ge buyer waybills" },
      { label: "Waybill Items", href: "/dictionaries/waybill-items", icon: ListTree, desc: "Line-item detail" },
      { label: "RS Unit Map", href: "/dictionaries/rs-unit-dimension-map", icon: Scale, desc: "Unit → dimension mapping" },
    ],
  },
  {
    title: "Finance",
    color: "bg-emerald-50 text-emerald-600",
    items: [
      { label: "Payments", href: "/dictionaries/payments", icon: Wallet, desc: "Payment records" },
      { label: "Payments Ledger", href: "/dictionaries/payments-ledger", icon: FileSpreadsheet, desc: "Ledger entries" },
      { label: "Payment Redistribution", href: "/dictionaries/payment-redistribution", icon: ArrowLeftRight, desc: "Reallocation" },
      { label: "Salary Accruals", href: "/dictionaries/salary-accruals", icon: DollarSign, desc: "Payroll accruals" },
      { label: "NBG Rates", href: "/dictionaries/nbg-rates", icon: TrendingUp, desc: "Exchange rates" },
      { label: "Conversions", href: "/dictionaries/conversions", icon: Scale, desc: "Currency conversions" },
    ],
  },
  {
    title: "Reports",
    color: "bg-violet-50 text-violet-600",
    items: [
      { label: "Payments Report", href: "/dictionaries/payments-report", icon: FileBarChart2, desc: "By project & code" },
      { label: "Projects Report", href: "/dictionaries/projects-report", icon: BarChart3, desc: "Project financials" },
      { label: "Services Report", href: "/dictionaries/services-report", icon: FileSpreadsheet, desc: "Service breakdown" },
    ],
  },
  {
    title: "Reference",
    color: "bg-slate-50 text-slate-600",
    items: [
      { label: "Counteragents", href: "/dictionaries/counteragents", icon: Users, desc: "Suppliers & clients" },
      { label: "Projects", href: "/admin/projects", icon: Building2, desc: "Project registry" },
      { label: "Jobs", href: "/dictionaries/jobs", icon: Layers2, desc: "Job definitions" },
      { label: "Currencies", href: "/dictionaries/currencies", icon: Globe, desc: "Currency list" },
      { label: "Countries", href: "/dictionaries/countries", icon: Globe, desc: "Country registry" },
      { label: "Entity Types", href: "/dictionaries/entity-types", icon: ListTree, desc: "Legal entity types" },
      { label: "Inventories", href: "/dictionaries/inventories", icon: Package, desc: "Inventory items" },
      { label: "Inventory Groups", href: "/dictionaries/inventory-groups", icon: Package, desc: "Item grouping" },
      { label: "Dimensions", href: "/dictionaries/dimensions", icon: Scale, desc: "Units of measure" },
    ],
  },
  {
    title: "Administration",
    color: "bg-rose-50 text-rose-600",
    items: [
      { label: "Financial Codes", href: "/admin/financial-codes", icon: BookOpen, desc: "Chart of accounts" },
      { label: "Users", href: "/admin/users", icon: Users, desc: "User management" },
      { label: "Attachments", href: "/admin/attachments", icon: FileSpreadsheet, desc: "File attachments" },
      { label: "Document Types", href: "/admin/document-types", icon: ClipboardList, desc: "Document registry" },
      { label: "Modules", href: "/admin/modules", icon: Layers2, desc: "Module config" },
      { label: "Permissions", href: "/admin/permissions", icon: ShieldCheck, desc: "Role permissions" },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3, desc: "Usage analytics" },
    ],
  },
];

export default function DictionariesIndex() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      {/* Page header */}
      <div className="border-b border-border pb-6">
        <h1 className="text-2xl font-semibold text-foreground">All Modules</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Navigate to any section of the application.
        </p>
      </div>

      {/* Sections */}
      {SECTIONS.map((section) => (
        <section key={section.title}>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {section.title}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {section.items.map(({ label, href, icon: Icon, desc }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3.5 shadow-xs hover:shadow-sm hover:border-border-strong transition-all"
              >
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${section.color} group-hover:opacity-80 transition-opacity`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
                  {desc && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{desc}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

import {
  Home, Landmark, Wallet, FileBarChart2, BookOpen, ClipboardList,
  Users, Globe, Banknote, ListTree, Package, Scale, ArrowLeftRight,
  DollarSign, TrendingUp, BarChart3, FileSpreadsheet, Settings,
  ShieldCheck, Layers2, Building2, Folder, FolderOpen, Database,
  CreditCard, ReceiptText, LayoutGrid, LineChart,
  Calendar, Tag, Star, Zap, Box, Archive,
  UserCheck, ShoppingCart, Truck, Coins, Receipt,
  ChartPie, Briefcase, Factory, Map, Hash, Link,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const ICON_MAP: Record<string, LucideIcon> = {
  Archive,
  ArrowLeftRight,
  BarChart3,
  Banknote,
  BookOpen,
  Box,
  Briefcase,
  Building2,
  Calendar,
  ChartPie,
  ClipboardList,
  Coins,
  CreditCard,
  Database,
  DollarSign,
  Factory,
  FileBarChart2,
  FileSpreadsheet,
  Folder,
  FolderOpen,
  Globe,
  Hash,
  Home,
  Landmark,
  LayoutGrid,
  LineChart,
  Link,
  ListTree,
  Map,
  Package,
  Receipt,
  ReceiptText,
  Scale,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Star,
  Tag,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
  Wallet,
  Layers2,
  Zap,
};

export function getIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Folder;
  return ICON_MAP[name] ?? Folder;
}

export const ICON_NAMES = Object.keys(ICON_MAP).sort();

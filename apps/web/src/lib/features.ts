import type { ElementType } from "react";
import {
  Home,
  Clock,
  Users,
  Wallet,
  LayoutGrid,
  Sparkles,
  Calendar,
  IdCard,
  PenLine,
  Settings,
  Target,
  ClipboardList,
  Receipt,
  FileSignature,
  TrendingUp,
  Star,
  Link2,
  FileText,
  Bot,
  CalendarDays,
  Phone,
  MessageSquare,
  CreditCard,
} from "@/components/animated-icons";

// Single source of truth for dashboard navigation and feature gating.
//
// The owner account (OWNER_EMAILS in the API config) always sees everything;
// every other account follows the visibility rows stored via the
// /feature-flags API, toggled from Settings → Features. Sidebar, command menu
// and the route guard all read this registry, so a feature only needs to be
// declared here once.

export interface FeatureSubItem {
  // Stable id for label overrides, e.g. "clients.leads".
  id: string;
  title: string;
  href: string;
  icon: ElementType;
  active: (path: string, tab: string) => boolean;
}

export interface FeatureDef {
  key: string;
  title: string;
  description: string;
  icon: ElementType;
  href: string;
  // Route prefixes (under /dashboard) the route guard blocks when hidden.
  routes: string[];
  subItems?: FeatureSubItem[];
  // Core surfaces that can never be toggled off (Home, Settings). Settings
  // lives off the rail: it opens from the sidebar profile menu / command menu.
  locked?: boolean;
  // Not in the sidebar rail — reachable via the command menu only.
  commandOnly?: boolean;
}

const onPath = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`);

export const FEATURES: FeatureDef[] = [
  {
    key: "home",
    title: "Home",
    description: "The daily overview dashboard.",
    icon: Home,
    href: "/dashboard",
    routes: [],
    locked: true,
  },
  {
    key: "booking",
    title: "Booking",
    description: "Consultation calls, bookable services and availability.",
    icon: Calendar,
    href: "/dashboard/booking",
    routes: ["/dashboard/booking"],
    subItems: [
      {
        id: "booking.calls",
        title: "Calls",
        href: "/dashboard/booking",
        icon: Phone,
        active: (p) => p === "/dashboard/booking" || p.startsWith("/dashboard/booking/calls"),
      },
      {
        id: "booking.services",
        title: "Services",
        href: "/dashboard/booking/services",
        icon: CalendarDays,
        active: (p) =>
          p.startsWith("/dashboard/booking/services") ||
          (p.startsWith("/dashboard/booking/") && !p.startsWith("/dashboard/booking/calls")),
      },
    ],
  },
  {
    key: "clients",
    title: "Clients",
    description: "Client roster, leads pipeline and intake forms.",
    icon: Users,
    href: "/dashboard/clients",
    routes: ["/dashboard/clients", "/dashboard/leads", "/dashboard/intake"],
    subItems: [
      {
        id: "clients.roster",
        title: "Clients Roster",
        href: "/dashboard/clients",
        icon: Users,
        // Precise active detection: handles both the ?tab= URL style used by
        // the panels/command menu and the legacy standalone routes.
        active: (p, t) => onPath(p, "/dashboard/clients") && (t === "" || t === "clients"),
      },
      {
        id: "clients.leads",
        title: "Leads Pipeline",
        href: "/dashboard/clients?tab=leads",
        icon: Target,
        active: (p, t) =>
          (p === "/dashboard/clients" && t === "leads") || onPath(p, "/dashboard/leads"),
      },
      {
        id: "clients.forms",
        title: "Intake Forms",
        href: "/dashboard/clients?tab=forms",
        icon: ClipboardList,
        active: (p, t) =>
          (p === "/dashboard/clients" && (t === "forms" || t === "intake")) ||
          onPath(p, "/dashboard/intake"),
      },
    ],
  },
  {
    key: "proposals",
    title: "Proposals",
    description: "Saved proposals, the AI composer and Book AI.",
    icon: Sparkles,
    href: "/dashboard/proposals",
    routes: ["/dashboard/proposals"],
    subItems: [
      {
        id: "proposals.saved",
        title: "Saved Proposals",
        href: "/dashboard/proposals",
        icon: FileText,
        active: (p, t) => p === "/dashboard/proposals" && (t === "" || t === "proposals"),
      },
      {
        id: "proposals.composer",
        title: "AI Composer",
        href: "/dashboard/proposals/new",
        icon: PenLine,
        active: (p) => onPath(p, "/dashboard/proposals/new"),
      },
      {
        id: "proposals.book-ai",
        title: "Book AI",
        href: "/dashboard/proposals?tab=book-ai",
        icon: Bot,
        active: (p, t) => p === "/dashboard/proposals" && t === "book-ai",
      },
    ],
  },
  {
    key: "projects",
    title: "Projects",
    description: "Project roster, invoices & billing and contracts.",
    icon: LayoutGrid,
    href: "/dashboard/projects",
    routes: ["/dashboard/projects", "/dashboard/invoices", "/dashboard/contracts"],
    subItems: [
      {
        id: "projects.roster",
        title: "Projects Roster",
        href: "/dashboard/projects",
        icon: LayoutGrid,
        active: (p, t) => onPath(p, "/dashboard/projects") && (t === "" || t === "projects"),
      },
      {
        id: "projects.invoices",
        title: "Invoices & Billing",
        href: "/dashboard/projects?tab=invoices",
        icon: Receipt,
        active: (p, t) =>
          (p === "/dashboard/projects" && t === "invoices") || onPath(p, "/dashboard/invoices"),
      },
      {
        id: "projects.contracts",
        title: "Contracts",
        href: "/dashboard/projects?tab=contracts",
        icon: FileSignature,
        active: (p, t) =>
          (p === "/dashboard/projects" && t === "contracts") || onPath(p, "/dashboard/contracts"),
      },
    ],
  },
  {
    key: "money",
    title: "Money",
    description: "Cash flow, expenses and runway.",
    icon: Wallet,
    href: "/dashboard/cashflow",
    routes: ["/dashboard/cashflow"],
  },
  {
    key: "time",
    title: "Time",
    description: "Time tracker and billable hours.",
    icon: Clock,
    href: "/dashboard/time-tracker",
    routes: ["/dashboard/time-tracker"],
  },
  {
    key: "planner",
    title: "Planner",
    description: "Visual planner boards and todos.",
    icon: PenLine,
    href: "/dashboard/planner",
    routes: ["/dashboard/planner"],
  },
  {
    key: "insights",
    title: "Insights",
    description: "Reports, testimonials and shared links.",
    icon: TrendingUp,
    href: "/dashboard/reports",
    routes: ["/dashboard/reports", "/dashboard/testimonials", "/dashboard/links"],
    subItems: [
      {
        id: "insights.reports",
        title: "Reports",
        href: "/dashboard/reports",
        icon: TrendingUp,
        active: (p) => onPath(p, "/dashboard/reports"),
      },
      {
        id: "insights.testimonials",
        title: "Testimonials",
        href: "/dashboard/testimonials",
        icon: Star,
        active: (p) => onPath(p, "/dashboard/testimonials"),
      },
      {
        id: "insights.links",
        title: "Shared Links",
        href: "/dashboard/links",
        icon: Link2,
        active: (p) => onPath(p, "/dashboard/links"),
      },
    ],
  },
  {
    key: "profile",
    title: "Profile",
    description: "Public profile report card and link pages.",
    icon: IdCard,
    href: "/dashboard/report-card",
    routes: ["/dashboard/report-card", "/dashboard/link-page"],
    subItems: [
      {
        id: "profile.report-card",
        title: "Profile Report Card",
        href: "/dashboard/report-card",
        icon: IdCard,
        active: (p) => onPath(p, "/dashboard/report-card"),
      },
      {
        id: "profile.link-page",
        title: "Link Page",
        href: "/dashboard/link-page",
        icon: Link2,
        active: (p) => onPath(p, "/dashboard/link-page"),
      },
    ],
  },
  {
    key: "inbox",
    title: "Inbox",
    description: "Payments, overdue invoices, contract activity and quotes — the live signal feed.",
    icon: MessageSquare,
    href: "/dashboard/inbox",
    routes: ["/dashboard/inbox"],
    commandOnly: true,
  },
  {
    key: "calendar",
    title: "Calendar",
    description: "Calendar events and Google Calendar sync (command menu).",
    icon: Calendar,
    href: "/dashboard/calendar",
    routes: [],
    locked: true,
    commandOnly: true,
  },
  {
    key: "billing",
    title: "Billing",
    description: "Plan, capacity usage and checkout (account menu).",
    icon: CreditCard,
    href: "/dashboard/billing",
    routes: [],
    locked: true,
    commandOnly: true,
  },
  {
    key: "settings",
    title: "Settings",
    description: "Workspace profile, invoicing defaults and feature visibility.",
    icon: Settings,
    href: "/dashboard/settings",
    routes: [],
    locked: true,
    commandOnly: true,
  },
];

// Command-menu entries: whole features plus tab shortcuts. `feature` is the
// visibility gate, `sub` (when set) supplies the label override for that row.
export interface CommandItem {
  title: string;
  href: string;
  icon: ElementType;
  feature: string;
  sub?: string;
}

export const COMMAND_ITEMS: CommandItem[] = [
  { title: "Home", href: "/dashboard", icon: Home, feature: "home" },
  { title: "Inbox", href: "/dashboard/inbox", icon: MessageSquare, feature: "inbox" },
  { title: "Clients", href: "/dashboard/clients", icon: Users, feature: "clients" },
  { title: "Leads", href: "/dashboard/clients?tab=leads", icon: Users, feature: "clients", sub: "clients.leads" },
  { title: "Forms", href: "/dashboard/clients?tab=forms", icon: Users, feature: "clients", sub: "clients.forms" },
  { title: "Time", href: "/dashboard/time-tracker", icon: Clock, feature: "time" },
  { title: "Projects", href: "/dashboard/projects", icon: LayoutGrid, feature: "projects" },
  { title: "Invoices", href: "/dashboard/projects?tab=invoices", icon: LayoutGrid, feature: "projects", sub: "projects.invoices" },
  { title: "Money", href: "/dashboard/cashflow", icon: Wallet, feature: "money" },
  { title: "Expenses", href: "/dashboard/cashflow?tab=expenses", icon: Wallet, feature: "money" },
  { title: "Proposals", href: "/dashboard/proposals", icon: Sparkles, feature: "proposals" },
  { title: "Calls", href: "/dashboard/booking", icon: Phone, feature: "booking", sub: "booking.calls" },
  { title: "Services", href: "/dashboard/booking/services", icon: CalendarDays, feature: "booking", sub: "booking.services" },
  { title: "Reports", href: "/dashboard/reports", icon: TrendingUp, feature: "insights", sub: "insights.reports" },
  { title: "Testimonials", href: "/dashboard/testimonials", icon: Star, feature: "insights", sub: "insights.testimonials" },
  { title: "Shared Links", href: "/dashboard/links", icon: Link2, feature: "insights", sub: "insights.links" },
  { title: "Calendar", href: "/dashboard/calendar", icon: Calendar, feature: "calendar" },
  { title: "Profile", href: "/dashboard/report-card", icon: IdCard, feature: "profile", sub: "profile.report-card" },
  { title: "Billing", href: "/dashboard/billing", icon: CreditCard, feature: "billing" },
  { title: "Settings", href: "/dashboard/settings", icon: Settings, feature: "settings" },
];

// Which feature a dashboard path belongs to (route-guard lookup). Locked
// surfaces return null — always allowed. Unknown paths also return null so a
// new page never gets accidentally locked before it's registered.
export function featureForPath(pathname: string | null | undefined): FeatureDef | null {
  if (!pathname) return null;
  for (const feature of FEATURES) {
    if (feature.routes.some((prefix) => onPath(pathname, prefix))) return feature;
  }
  return null;
}

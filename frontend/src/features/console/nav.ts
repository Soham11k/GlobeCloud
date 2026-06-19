import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  Route,
  Package,
  RefreshCw,
  MessageSquare,
  Globe,
  BookOpen,
  ScrollText,
  CreditCard,
  Users,
  KeyRound,
} from "lucide-react";

export type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  gateway?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { to: "/app", icon: LayoutGrid, label: "Overview", end: true },
      { to: "/app/route", icon: Route, label: "Routing" },
      { to: "/app/catalog", icon: Package, label: "Catalog" },
      { to: "/app/sync", icon: RefreshCw, label: "Replication" },
      { to: "/app/agent", icon: MessageSquare, label: "Agent" },
    ],
  },
  {
    label: "Platform",
    items: [
      { to: "/app/docs", icon: BookOpen, label: "Knowledge" },
      { to: "/app/audit", icon: ScrollText, label: "Audit" },
      { to: "/app/fleet", icon: Globe, label: "Fleet", gateway: true },
    ],
  },
  {
    label: "Settings",
    items: [
      { to: "/app/settings/billing", icon: CreditCard, label: "Billing" },
      { to: "/app/settings/team", icon: Users, label: "Team" },
      { to: "/app/settings/api-keys", icon: KeyRound, label: "API keys" },
    ],
  },
];

export function flattenNav(isGateway: boolean): NavItem[] {
  return NAV_GROUPS.flatMap((g) =>
    g.items.filter((item) => !item.gateway || isGateway)
  );
}

export const MOBILE_SHORTCUTS = [
  { to: "/app", icon: LayoutGrid, label: "Overview", end: true },
  { to: "/app/catalog", icon: Package, label: "Catalog" },
  { to: "/app/agent", icon: MessageSquare, label: "Agent" },
  { to: "/app/route", icon: Route, label: "Routing" },
] as const;

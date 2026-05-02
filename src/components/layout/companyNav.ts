import { LayoutDashboard, Bus, Map, CalendarClock, Ticket, Package, Users, Tag, Building2, Settings } from "lucide-react";
import type { DashNavItem } from "./DashboardShell";

export const companyNav: DashNavItem[] = [
  { to: "/company", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/company/fleet", label: "Fleet", icon: Bus },
  { to: "/company/routes", label: "Routes", icon: Map },
  { to: "/company/trips", label: "Trips", icon: CalendarClock },
  { to: "/company/bookings", label: "Bookings", icon: Ticket },
  { to: "/cashier", label: "Sell ticket", icon: Ticket },
  { to: "/track-parcel", label: "Track parcel", icon: Package },
  { to: "/company/settings", label: "Settings", icon: Settings },
];

export const companyNavExtras = { Users, Tag, Building2 };

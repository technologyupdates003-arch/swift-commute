import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bus, Map, CalendarClock, Ticket, LayoutDashboard, Tag, Package, Building2, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import DiscountsManager from "@/components/admin/DiscountsManager";
import BusLayoutEditor from "@/components/admin/BusLayoutEditor";
import ParcelsManager from "@/components/admin/ParcelsManager";
import BranchesManager from "@/components/admin/BranchesManager";
import RoutePricingManager from "@/components/admin/RoutePricingManager";
import StaffManager from "@/components/admin/StaffManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardShell, { DashNavItem } from "@/components/layout/DashboardShell";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const nav: DashNavItem[] = [
  { to: "/company", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/cashier", label: "Sell ticket", icon: Ticket },
  { to: "/track-parcel", label: "Track parcel", icon: Package },
  { to: "/send-parcel", label: "New parcel", icon: Package },
  { to: "/", label: "Public site", icon: Bus },
];

const CompanyDashboard = () => {
  const { companyId } = useAuth();

  return (
    <DashboardShell
      title="Company"
      subtitle="Operations control"
      nav={nav}
      actions={
        <Link to="/cashier">
          <Button size="sm" className="gap-1.5 bg-brand-gradient hover:opacity-90 hidden sm:inline-flex">
            <Ticket className="h-4 w-4" /> Sell ticket
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Company dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage fleet, routes, schedules, bookings, parcels and discounts.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile icon={<Bus className="h-5 w-5" />} title="Fleet" desc="Buses & layouts" />
          <Tile icon={<Map className="h-5 w-5" />} title="Routes" desc="Origin → destination" />
          <Tile icon={<CalendarClock className="h-5 w-5" />} title="Trips" desc="Daily schedules" />
          <Tile icon={<Ticket className="h-5 w-5" />} title="Bookings" desc="Live seat sales" />
        </div>

        {companyId ? (
          <Tabs defaultValue="bookings" className="w-full">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="bookings"><Bus className="mr-1.5 h-4 w-4" />Fleet & seats</TabsTrigger>
              <TabsTrigger value="staff"><Users className="mr-1.5 h-4 w-4" />Staff</TabsTrigger>
              <TabsTrigger value="discounts"><Tag className="mr-1.5 h-4 w-4" />Discounts</TabsTrigger>
              <TabsTrigger value="parcels"><Package className="mr-1.5 h-4 w-4" />Parcels</TabsTrigger>
              <TabsTrigger value="branches"><Building2 className="mr-1.5 h-4 w-4" />Branches & pricing</TabsTrigger>
            </TabsList>
            <TabsContent value="bookings" className="mt-6">
              <BusLayoutEditor companyId={companyId} />
            </TabsContent>
            <TabsContent value="staff" className="mt-6">
              <StaffManager companyId={companyId} />
            </TabsContent>
            <TabsContent value="discounts" className="mt-6">
              <DiscountsManager companyId={companyId} />
            </TabsContent>
            <TabsContent value="parcels" className="mt-6">
              <ParcelsManager companyId={companyId} />
            </TabsContent>
            <TabsContent value="branches" className="mt-6 space-y-6">
              <BranchesManager companyId={companyId} />
              <RoutePricingManager companyId={companyId} />
            </TabsContent>
          </Tabs>
        ) : (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">
            Your account isn't linked to a company yet. Ask the super admin to assign you.
          </CardContent></Card>
        )}
      </div>
    </DashboardShell>
  );
};

const Tile = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
  <Card className="card-soft hover-lift">
    <CardHeader className="flex flex-row items-center gap-3 space-y-0">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-primary-foreground shadow-elegant">{icon}</div>
      <CardTitle className="text-base">{title}</CardTitle>
    </CardHeader>
    <CardContent className="text-sm text-muted-foreground">{desc}</CardContent>
  </Card>
);

export default CompanyDashboard;

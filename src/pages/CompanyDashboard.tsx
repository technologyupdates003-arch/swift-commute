import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bus, Map, CalendarClock, Ticket, Tag, Package, Building2, Users, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import DiscountsManager from "@/components/admin/DiscountsManager";
import ParcelsManager from "@/components/admin/ParcelsManager";
import BranchesManager from "@/components/admin/BranchesManager";
import RoutePricingManager from "@/components/admin/RoutePricingManager";
import StaffManager from "@/components/admin/StaffManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardShell from "@/components/layout/DashboardShell";
import { companyNav } from "@/components/layout/companyNav";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const CompanyDashboard = () => {
  const { companyId } = useAuth();

  return (
    <DashboardShell
      title="Company"
      subtitle="Operations control"
      nav={companyNav}
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
          <Tile to="/company/fleet" icon={<Bus className="h-5 w-5" />} title="Fleet" desc="Buses & layouts" />
          <Tile to="/company/routes" icon={<Map className="h-5 w-5" />} title="Routes" desc="Origin → destination" />
          <Tile to="/company/trips" icon={<CalendarClock className="h-5 w-5" />} title="Trips" desc="Daily schedules" />
          <Tile to="/company/bookings" icon={<Ticket className="h-5 w-5" />} title="Bookings" desc="Live seat sales" />
          <Tile to="/company/settings" icon={<SettingsIcon className="h-5 w-5" />} title="Settings" desc="Company & M-Pesa" />
        </div>

        {companyId ? (
          <Tabs defaultValue="staff" className="w-full">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="staff"><Users className="mr-1.5 h-4 w-4" />Staff</TabsTrigger>
              <TabsTrigger value="discounts"><Tag className="mr-1.5 h-4 w-4" />Discounts</TabsTrigger>
              <TabsTrigger value="parcels"><Package className="mr-1.5 h-4 w-4" />Parcels</TabsTrigger>
              <TabsTrigger value="branches"><Building2 className="mr-1.5 h-4 w-4" />Branches & pricing</TabsTrigger>
            </TabsList>
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

const Tile = ({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) => (
  <Link to={to}>
    <Card className="card-soft hover-lift cursor-pointer h-full">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-primary-foreground shadow-elegant">{icon}</div>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{desc}</CardContent>
    </Card>
  </Link>
);

export default CompanyDashboard;

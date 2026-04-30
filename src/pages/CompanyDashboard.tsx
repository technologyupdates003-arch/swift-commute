import PublicHeader from "@/components/layout/PublicHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bus, Map, CalendarClock, Ticket } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import DiscountsManager from "@/components/admin/DiscountsManager";
import BusLayoutEditor from "@/components/admin/BusLayoutEditor";
import ParcelsManager from "@/components/admin/ParcelsManager";
import BranchesManager from "@/components/admin/BranchesManager";
import RoutePricingManager from "@/components/admin/RoutePricingManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CompanyDashboard = () => {
  const { companyId } = useAuth();

  return (
    <div className="min-h-screen bg-muted/20">
      <PublicHeader />
      <div className="container space-y-8 py-8">
        <div>
          <h1 className="text-3xl font-bold">Company dashboard</h1>
          <p className="mt-2 text-muted-foreground">Manage fleet, routes, schedules, bookings, seat layouts and your discount codes.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Tile icon={<Bus className="h-5 w-5" />} title="Buses" desc="Coming next" />
          <Tile icon={<Map className="h-5 w-5" />} title="Routes" desc="Coming next" />
          <Tile icon={<CalendarClock className="h-5 w-5" />} title="Trips" desc="Coming next" />
          <Tile icon={<Ticket className="h-5 w-5" />} title="Bookings" desc="Coming next" />
        </div>

        {companyId ? (
          <Tabs defaultValue="bookings" className="w-full">
            <TabsList>
              <TabsTrigger value="bookings">Bookings & seats</TabsTrigger>
              <TabsTrigger value="discounts">Discounts</TabsTrigger>
              <TabsTrigger value="parcels">Parcels</TabsTrigger>
              <TabsTrigger value="branches">Branches & pricing</TabsTrigger>
            </TabsList>
            <TabsContent value="bookings" className="mt-6">
              <BusLayoutEditor companyId={companyId} />
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
    </div>
  );
};

const Tile = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
  <Card className="shadow-card">
    <CardHeader className="flex flex-row items-center gap-3 space-y-0">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-gradient text-primary-foreground">{icon}</div>
      <CardTitle className="text-base">{title}</CardTitle>
    </CardHeader>
    <CardContent className="text-sm text-muted-foreground">{desc}</CardContent>
  </Card>
);

export default CompanyDashboard;

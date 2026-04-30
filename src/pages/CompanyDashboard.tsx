import PublicHeader from "@/components/layout/PublicHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bus, Map, CalendarClock, Ticket } from "lucide-react";

const CompanyDashboard = () => {
  return (
    <div className="min-h-screen bg-muted/20">
      <PublicHeader />
      <div className="container py-8">
        <h1 className="text-3xl font-bold">Company dashboard</h1>
        <p className="mt-2 text-muted-foreground">Manage fleet, routes, schedules and bookings.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Tile icon={<Bus className="h-5 w-5" />} title="Buses" desc="Coming next" />
          <Tile icon={<Map className="h-5 w-5" />} title="Routes" desc="Coming next" />
          <Tile icon={<CalendarClock className="h-5 w-5" />} title="Trips" desc="Coming next" />
          <Tile icon={<Ticket className="h-5 w-5" />} title="Bookings" desc="Coming next" />
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          Phase 1 ships the public booking flow + multi-tenant foundation. Fleet/route CRUD lands in the next iteration.
        </p>
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

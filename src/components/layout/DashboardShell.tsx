import { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Bus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export interface DashNavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

interface Props {
  title: string;
  subtitle?: string;
  nav: DashNavItem[];
  children: ReactNode;
  actions?: ReactNode;
}

const DashboardShell = ({ title, subtitle, nav, children, actions }: Props) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-primary-foreground shadow-elegant">
              <Bus className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="text-sm font-extrabold tracking-tight">
                <span className="text-primary">Abancool</span>{" "}
                <span className="text-secondary">Travel</span>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{title}</div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {actions}
            <span className="hidden sm:inline text-xs text-muted-foreground max-w-[180px] truncate">
              {user?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={async () => { await signOut(); navigate("/"); }}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex sticky top-16 h-[calc(100vh-4rem)] w-60 shrink-0 flex-col gap-1 border-r bg-background p-3">
          <div className="px-2 pb-3">
            <div className="text-base font-bold">{title}</div>
            {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
          </div>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/80 hover:bg-muted hover:text-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 p-4 md:p-6 pb-24 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur">
        <div className="grid grid-cols-5">
          {nav.slice(0, 5).map((item) => {
            const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default DashboardShell;

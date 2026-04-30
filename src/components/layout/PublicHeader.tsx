import { Link, useNavigate } from "react-router-dom";
import { Bus, LogIn, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const PublicHeader = () => {
  const { user, signOut, hasRole } = useAuth();
  const navigate = useNavigate();

  const dashboardPath = hasRole("super_admin")
    ? "/admin"
    : hasRole("company_admin")
    ? "/company"
    : "/account";

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-gradient text-primary-foreground shadow-elegant">
            <Bus className="h-5 w-5" />
          </div>
          <span className="text-lg tracking-tight">RoadLink</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/search">
            <Button variant="ghost" size="sm">Find a trip</Button>
          </Link>
          {user ? (
            <>
              <Link to={dashboardPath}>
                <Button variant="outline" size="sm" className="gap-2">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => { await signOut(); navigate("/"); }}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button size="sm" className="gap-2 bg-brand-gradient hover:opacity-90">
                <LogIn className="h-4 w-4" /> Staff login
              </Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};

export default PublicHeader;

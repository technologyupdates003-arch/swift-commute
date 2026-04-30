import { Link, NavLink, useNavigate } from "react-router-dom";
import { Bus, LogOut, LayoutDashboard, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const PublicHeader = () => {
  const { user, signOut, hasRole } = useAuth();
  const navigate = useNavigate();

  const dashboardPath = hasRole("super_admin")
    ? "/admin"
    : hasRole("cashier")
    ? "/cashier"
    : hasRole("company_admin") || hasRole("parcel_clerk") || hasRole("driver") || hasRole("conductor")
    ? "/company"
    : "/account";

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    cn(
      "px-2 py-1 text-[15px] font-semibold transition-colors",
      isActive ? "text-primary" : "text-foreground hover:text-primary"
    );

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container flex h-[72px] items-center justify-between gap-6">
        {/* Logo: Abancool Travel */}
        <Link to="/" className="flex items-center gap-2" aria-label="Abancool Travel home">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-primary-foreground shadow-elegant">
            <Bus className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-extrabold tracking-tight leading-none">
            <span className="text-primary">Abancool</span>{" "}
            <span className="text-secondary">Travel</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/offers" className={linkCls}>Offers</NavLink>
          <NavLink to="/send-parcel" className={linkCls}>Send Parcel</NavLink>
          <NavLink to="/track-parcel" className={linkCls}>Track Parcel</NavLink>
          <NavLink to="/print-ticket" className={linkCls}>Print Ticket</NavLink>
          <NavLink to="/contact-us" className={linkCls}>Need Help?</NavLink>
          <NavLink to="/blog" className={linkCls}>Blog</NavLink>
          <NavLink to="/api" className={linkCls}>API</NavLink>
        </nav>

        <div className="flex items-center gap-2">
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
            <Link to="/auth" className="flex items-center gap-1.5 text-[15px] font-semibold text-secondary hover:text-secondary/80">
              <User className="h-4 w-4 fill-current" />
              Login/SignUp
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default PublicHeader;

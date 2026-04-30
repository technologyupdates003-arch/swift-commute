import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ReactNode } from "react";

type AppRole = "super_admin" | "company_admin" | "cashier" | "parcel_clerk" | "driver" | "conductor" | "customer";

const RequireRole = ({ roles, children }: { roles: AppRole[]; children: ReactNode }) => {
  const { user, roles: userRoles, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;
  const allowed = roles.some((r) => userRoles.includes(r));
  if (!allowed) {
    return (
      <div className="container py-20 text-center">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="mt-2 text-muted-foreground">
          Your account doesn't have permission for this area.
        </p>
      </div>
    );
  }
  return <>{children}</>;
};

export default RequireRole;

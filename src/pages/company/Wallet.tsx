import DashboardShell from "@/components/layout/DashboardShell";
import { companyNav } from "@/components/layout/companyNav";
import { useAuth } from "@/hooks/useAuth";
import CompanyWallet from "@/components/company/CompanyWallet";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function WalletPage() {
  const { companyId } = useAuth();
  return (
    <DashboardShell title="Wallet" nav={companyNav}>
      <div className="space-y-4">
        <Alert>
          <AlertDescription>
            Abanremit collects all payments on your behalf. Your earnings (after platform commission)
            land in this wallet. Request a payout to M-Pesa or bank anytime.
          </AlertDescription>
        </Alert>
        {companyId ? <CompanyWallet companyId={companyId} /> : <p>Loading…</p>}
      </div>
    </DashboardShell>
  );
}

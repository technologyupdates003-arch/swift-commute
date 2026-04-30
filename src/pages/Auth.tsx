import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Bus } from "lucide-react";
import PublicHeader from "@/components/layout/PublicHeader";

const signInSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(128),
});

const signUpSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(20).optional().or(z.literal("")),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(128),
});

type AppRole = "super_admin" | "company_admin" | "cashier" | "parcel_clerk" | "driver" | "conductor" | "customer";

const STAFF_ROLES: AppRole[] = ["super_admin", "company_admin", "cashier", "parcel_clerk", "driver", "conductor"];

async function routeAfterLogin(userId: string, navigate: (p: string) => void) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as AppRole);
  if (roles.includes("super_admin")) return navigate("/admin");
  if (roles.includes("cashier")) return navigate("/cashier");
  if (roles.some((r) => STAFF_ROLES.includes(r))) return navigate("/company");
  navigate("/");
}

const Auth = () => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  // Sign in state
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");

  // Sign up state
  const [suName, setSuName] = useState("");
  const [suPhone, setSuPhone] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signInSchema.safeParse({ email: siEmail, password: siPassword });
    if (!parsed.success) {
      toast({ title: "Invalid input", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
    setBusy(false);
    if (error) { toast({ title: "Sign in failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Welcome back" });
    if (data.user) await routeAfterLogin(data.user.id, navigate);
    else navigate("/");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signUpSchema.safeParse({ full_name: suName, phone: suPhone, email: suEmail, password: suPassword });
    if (!parsed.success) {
      toast({ title: "Invalid input", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: parsed.data.full_name, phone: parsed.data.phone || null },
      },
    });
    setBusy(false);
    if (error) { toast({ title: "Sign up failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Account created", description: "Check your email to verify your account, then sign in." });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <PublicHeader />
      <div className="container flex items-center justify-center py-16">
        <Card className="w-full max-w-md shadow-elegant">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-brand-gradient text-primary-foreground">
              <Bus className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Welcome to Abancool Travel</CardTitle>
            <CardDescription>Sign in or create an account to manage bookings and parcels.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="si-email">Email</Label>
                    <Input id="si-email" type="email" autoComplete="email" required value={siEmail} onChange={(e) => setSiEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="si-password">Password</Label>
                    <Input id="si-password" type="password" autoComplete="current-password" required value={siPassword} onChange={(e) => setSiPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full bg-brand-gradient hover:opacity-90" disabled={busy}>
                    {busy ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="su-name">Full name</Label>
                    <Input id="su-name" required value={suName} onChange={(e) => setSuName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-phone">Phone (optional)</Label>
                    <Input id="su-phone" type="tel" value={suPhone} onChange={(e) => setSuPhone(e.target.value)} placeholder="07XX XXX XXX" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" type="email" autoComplete="email" required value={suEmail} onChange={(e) => setSuEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-password">Password</Label>
                    <Input id="su-password" type="password" autoComplete="new-password" required value={suPassword} onChange={(e) => setSuPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full bg-brand-gradient hover:opacity-90" disabled={busy}>
                    {busy ? "Creating account…" : "Create account"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Staff accounts (cashier, clerk, admin) are created by your company administrator.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;

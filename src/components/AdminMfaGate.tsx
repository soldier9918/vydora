import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type Stage = "loading" | "enroll" | "verify" | "ok";

/** Requires an authenticator-app code (AAL2) before the admin area renders. */
export default function AdminMfaGate({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const check = async () => {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal2") return setStage("ok");
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp?.find((f) => f.status === "verified");
    if (verified) { setFactorId(verified.id); return setStage("verify"); }
    // Clear half-finished setups, then start a fresh one.
    for (const f of data?.all ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data: en, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Vydora admin ${Date.now()}` });
    if (error || !en) { toast.error(error?.message ?? "Could not start setup"); return; }
    setFactorId(en.id); setQr(en.totp.qr_code); setSecret(en.totp.secret); setStage("enroll");
  };
  useEffect(() => { check(); }, []);

  const submit = async () => {
    if (!/^\d{6}$/.test(code)) return toast.error("Enter the 6-digit code");
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (error) { setCode(""); return toast.error("That code didn't work. Try the newest one."); }
    toast.success("Admin unlocked");
    setStage("ok");
  };

  if (stage === "ok") return <>{children}</>;
  if (stage === "loading") return <div className="min-h-screen bg-background" />;
  return (
    <div className="min-h-screen grid place-items-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 space-y-4 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
        <h1 className="font-display text-xl font-bold">{stage === "enroll" ? "Set up your authenticator app" : "Enter your admin code"}</h1>
        {stage === "enroll" ? (
          <>
            <p className="text-sm text-muted-foreground">Scan this with Google Authenticator, 1Password, Authy or similar, then enter the 6-digit code.</p>
            <img src={qr} alt="Authenticator QR code" className="mx-auto h-44 w-44 rounded bg-foreground p-2" />
            <p className="text-xs text-muted-foreground break-all">Or type this key: <span className="font-mono text-foreground">{secret}</span></p>
          </>
        ) : <p className="text-sm text-muted-foreground">Open your authenticator app and enter the 6-digit code for Vydora.</p>}
        <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} autoFocus
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && submit()}
          className="text-center text-lg tracking-[0.5em]" placeholder="000000" aria-label="6-digit code" />
        <Button className="w-full" onClick={submit} disabled={busy}>{busy ? "Checking…" : "Unlock admin"}</Button>
      </div>
    </div>
  );
}

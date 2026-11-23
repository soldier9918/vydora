import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { needsAnswer, onConsentChange, readChoice, saveChoices, type Purpose } from "@/lib/consent";

const PURPOSES: Purpose[] = ["analytics", "advertising"];
export const OPEN_COOKIE_SETTINGS = "open-cookie-settings";
export const openCookieSettings = () => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS));

export default function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [sw, setSw] = useState({ analytics: false, advertising: false });
  const ref = useRef<HTMLDivElement>(null);
  const gpc = typeof navigator !== "undefined" && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

  const syncSwitches = () => setSw({ analytics: readChoice("analytics") === "granted", advertising: readChoice("advertising") === "granted" });

  useEffect(() => {
    void needsAnswer(PURPOSES).then((n) => n && setOpen(true));
    const show = () => { syncSwitches(); setSettings(true); setOpen(true); };
    window.addEventListener(OPEN_COOKIE_SETTINGS, show);
    const off = onConsentChange(syncSwitches);
    return () => { window.removeEventListener(OPEN_COOKIE_SETTINGS, show); off(); };
  }, []);
  useEffect(() => { if (open) ref.current?.focus(); }, [open, settings]);

  if (!open) return null;
  const all = (choice: "granted" | "denied") => { saveChoices({ analytics: choice, advertising: choice }); setOpen(false); setSettings(false); };

  return (
    <div ref={ref} tabIndex={-1} role="region" aria-label="Cookie choices"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-xl rounded-xl border border-border bg-card p-5 text-sm shadow-lg outline-none">
      <p className="font-semibold text-foreground">Your privacy choices</p>
      <p className="mt-2 text-muted-foreground">
        We count visits without cookies. If you accept, we also measure clicks, and use advertising cookies to see which of our ads bring people to Vydora.{" "}
        <Link to="/privacy" className="underline hover:text-primary">Privacy policy</Link>
      </p>
      {settings && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          {gpc && <p className="text-xs text-muted-foreground">Your browser's privacy signal is on, so measurement and advertising stay off.</p>}
          <div className="flex items-center justify-between gap-4"><div><p className="font-medium">Necessary</p><p className="text-xs text-muted-foreground">Sign-in and your saved choices. Always on.</p></div><span className="text-xs text-muted-foreground">Always on</span></div>
          <label className="flex items-center justify-between gap-4"><div><p className="font-medium">Analytics, provided by Lovable</p><p className="text-xs text-muted-foreground">Clicks and how features are used.</p></div>
            <Switch checked={sw.analytics && !gpc} disabled={gpc} onCheckedChange={(v) => setSw((s) => ({ ...s, analytics: v }))} /></label>
          <label className="flex items-center justify-between gap-4"><div><p className="font-medium">Advertising, provided by Google</p><p className="text-xs text-muted-foreground">Measures sign-ups and purchases from our ads.</p></div>
            <Switch checked={sw.advertising && !gpc} disabled={gpc} onCheckedChange={(v) => setSw((s) => ({ ...s, advertising: v }))} /></label>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button className="flex-1" variant="secondary" onClick={() => all("denied")}>Reject all</Button>
        <Button className="flex-1" variant="secondary" onClick={() => all("granted")}>Accept all</Button>
        {settings ? (
          <Button className="w-full" onClick={() => { saveChoices({ analytics: sw.analytics ? "granted" : "denied", advertising: sw.advertising ? "granted" : "denied" }); setOpen(false); setSettings(false); }}>Save choices</Button>
        ) : (
          <Button className="w-full" variant="ghost" onClick={() => { syncSwitches(); setSettings(true); }}>Cookie settings</Button>
        )}
      </div>
    </div>
  );
}

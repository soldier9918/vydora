import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, Megaphone, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const TONES = {
  info: { label: "Info", cls: "bg-primary text-primary-foreground", Icon: Info },
  update: { label: "New feature", cls: "bg-accent text-accent-foreground", Icon: Sparkles },
  warning: { label: "Maintenance", cls: "bg-secondary text-secondary-foreground", Icon: AlertTriangle },
  urgent: { label: "Urgent", cls: "bg-destructive text-destructive-foreground", Icon: Megaphone },
} as const;
export type Tone = keyof typeof TONES;

export type BannerItem = { id: string; message: string; link_url: string | null; link_text: string | null; tone: string; allow_dismiss: boolean; updated_at: string };

const KEY = "vydora-dismissed-announcements";
const dismissKey = (a: BannerItem) => `${a.id}@${a.updated_at}`;
const readDismissed = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };

export function BannerBar({ a, onDismiss }: { a: BannerItem; onDismiss?: () => void }) {
  const t = TONES[(a.tone as Tone)] ?? TONES.info;
  const internal = a.link_url?.startsWith("/");
  const label = a.link_text || "Learn more";
  return (
    <div className={`${t.cls} text-sm`} role="status">
      <div className="container flex min-h-10 items-center gap-3 py-2">
        <t.Icon className="h-4 w-4 shrink-0" />
        <p className="flex-1">
          {a.message}
          {a.link_url && (internal
            ? <Link to={a.link_url} className="ml-2 font-semibold underline underline-offset-2">{label}</Link>
            : <a href={a.link_url} target="_blank" rel="noopener noreferrer" className="ml-2 font-semibold underline underline-offset-2">{label}</a>)}
        </p>
        {a.allow_dismiss && onDismiss && (
          <button onClick={onDismiss} aria-label="Close announcement" className="rounded p-1 hover:opacity-80"><X className="h-4 w-4" /></button>
        )}
      </div>
    </div>
  );
}

export default function AnnouncementBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const { data } = useQuery({
    queryKey: ["active-announcements", user?.id ?? "anon"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("active_announcements");
      if (error) return [];
      return (data ?? []) as BannerItem[];
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  const items = (data ?? []).filter((a) => !a.allow_dismiss || !dismissed.includes(dismissKey(a)));
  if (!items.length) return null;
  const dismiss = (a: BannerItem) => {
    const next = [...dismissed, dismissKey(a)].slice(-50);
    localStorage.setItem(KEY, JSON.stringify(next));
    setDismissed(next);
  };
  return <div>{items.map((a) => <BannerBar key={a.id} a={a} onDismiss={() => dismiss(a)} />)}</div>;
}

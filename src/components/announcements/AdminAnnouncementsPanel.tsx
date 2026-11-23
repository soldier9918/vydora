import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BannerBar, TONES, type Tone } from "./AnnouncementBanner";

type Row = { id: string; message: string; link_url: string | null; link_text: string | null; tone: string; audience: string; starts_at: string | null; ends_at: string | null; is_active: boolean; allow_dismiss: boolean; updated_at: string };

const AUDIENCES = { all: "Everyone", logged_in: "Signed-in users", paid_only: "Creator & Pro only" } as const;
const toLocal = (d: string | null) => (d ? new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");

export function statusOf(r: Pick<Row, "is_active" | "starts_at" | "ends_at">, now = Date.now()) {
  if (!r.is_active) return "Paused";
  if (r.ends_at && new Date(r.ends_at).getTime() <= now) return "Expired";
  if (r.starts_at && new Date(r.starts_at).getTime() > now) return "Scheduled";
  return "Live now";
}

const blank = { id: null as string | null, message: "", link_url: "", link_text: "", tone: "info" as Tone, audience: "all", starts_at: "", ends_at: "", is_active: true, allow_dismiss: true };

export default function AdminAnnouncementsPanel() {
  const qc = useQueryClient();
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const { data: rows = [] } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => { const { data, error } = await supabase.rpc("admin_announcements"); if (error) throw error; return data as Row[]; },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-announcements"] }); qc.invalidateQueries({ queryKey: ["active-announcements"] }); };

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_save_announcement", {
      _id: f.id as string, _message: f.message, _link_url: f.link_url, _link_text: f.link_text, _tone: f.tone, _audience: f.audience,
      _starts_at: (f.starts_at ? new Date(f.starts_at).toISOString() : null) as string, _ends_at: (f.ends_at ? new Date(f.ends_at).toISOString() : null) as string,
      _is_active: f.is_active, _allow_dismiss: f.allow_dismiss,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(f.id ? "Announcement updated" : "Announcement posted");
    setF(blank); refresh();
  };
  const toggle = async (r: Row) => { const { error } = await supabase.rpc("admin_set_announcement_active", { _id: r.id, _active: !r.is_active }); if (error) toast.error(error.message); refresh(); };
  const remove = async (r: Row) => { if (!confirm("Delete this announcement?")) return; const { error } = await supabase.rpc("admin_delete_announcement", { _id: r.id }); if (error) toast.error(error.message); refresh(); };
  const edit = (r: Row) => setF({ id: r.id, message: r.message, link_url: r.link_url ?? "", link_text: r.link_text ?? "", tone: r.tone as Tone, audience: r.audience, starts_at: toLocal(r.starts_at), ends_at: toLocal(r.ends_at), is_active: r.is_active, allow_dismiss: r.allow_dismiss });

  const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  return (
    <div className="mt-4 space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-display text-lg font-bold">{f.id ? "Edit announcement" : "New announcement"}</h3>
        <div>
          <Label htmlFor="an-msg">Message</Label>
          <Input id="an-msg" maxLength={280} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Scheduled maintenance tonight at 11 PM UK time" />
          <p className="mt-1 text-xs text-muted-foreground">{f.message.length}/280</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="an-url">Link (optional)</Label><Input id="an-url" value={f.link_url} onChange={(e) => setF({ ...f, link_url: e.target.value })} placeholder="/pricing or https://…" /></div>
          <div><Label htmlFor="an-lt">Link text</Label><Input id="an-lt" maxLength={40} value={f.link_text} onChange={(e) => setF({ ...f, link_text: e.target.value })} placeholder="Learn more" /></div>
          <div><Label htmlFor="an-tone">Style</Label>
            <select id="an-tone" className={sel} value={f.tone} onChange={(e) => setF({ ...f, tone: e.target.value as Tone })}>
              {Object.entries(TONES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select></div>
          <div><Label htmlFor="an-aud">Who sees it</Label>
            <select id="an-aud" className={sel} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
              {Object.entries(AUDIENCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div><Label htmlFor="an-s">Starts (optional)</Label><Input id="an-s" type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></div>
          <div><Label htmlFor="an-e">Ends (optional)</Label><Input id="an-e" type="datetime-local" value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} /></div>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} />Switched on</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.allow_dismiss} onCheckedChange={(v) => setF({ ...f, allow_dismiss: v })} />Users can close it</label>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
          <div className="overflow-hidden rounded-md border border-border">
            <BannerBar a={{ id: "preview", message: f.message || "Your message will appear here", link_url: f.link_url || null, link_text: f.link_text || null, tone: f.tone, allow_dismiss: f.allow_dismiss, updated_at: "" }} onDismiss={() => {}} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={busy || f.message.trim().length < 3}>{f.id ? "Save changes" : "Post announcement"}</Button>
          {f.id && <Button variant="ghost" onClick={() => setF(blank)}>Cancel</Button>}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Status</th><th className="p-3">Message</th><th className="p-3">Who</th><th className="p-3">Starts</th><th className="p-3">Ends</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="p-4 text-muted-foreground">No announcements yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3 whitespace-nowrap font-semibold">{statusOf(r)}</td>
                <td className="p-3">{r.message}</td>
                <td className="p-3 whitespace-nowrap">{AUDIENCES[r.audience as keyof typeof AUDIENCES] ?? r.audience}</td>
                <td className="p-3 whitespace-nowrap">{fmt(r.starts_at)}</td>
                <td className="p-3 whitespace-nowrap">{fmt(r.ends_at)}</td>
                <td className="p-3 whitespace-nowrap space-x-1">
                  <Button size="sm" variant="outline" onClick={() => toggle(r)}>{r.is_active ? "Pause" : "Switch on"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => edit(r)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(r)}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { COMMUNITY_CATEGORIES, categoryLabel, embedUrl, watchUrl } from "@/lib/community";

type Sub = { id: string; youtube_video_id: string; title: string; description: string; category: string; verified_vydora: boolean; status: string; featured: boolean;
  consent_text: string; consent_at: string; withdrawn_at: string | null; reviewed_at: string | null; review_note: string | null; created_at: string; email: string | null;
  display_name: string; channel_name: string; channel_url: string; consent_withdrawn_at: string | null; open_reports: number };
type Report = { id: string; submission_id: string; reason: string; details: string; status: string; created_at: string; title: string };
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");

export default function AdminCommunityPanel() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("pending");
  const [preview, setPreview] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ["admin-community"], queryFn: async () => {
    const { data, error } = await supabase.rpc("admin_community"); if (error) throw error; return data as unknown as { submissions: Sub[]; reports: Report[] }; } });
  const act = async (id: string, action: string, extra: { _note?: string; _category?: string; _description?: string } = {}) => {
    const { error } = await supabase.rpc("admin_community_moderate", { _id: id, _action: action, ...extra });
    if (error) toast.error(error.message); else { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-community"] }); }
  };
  const subs = (data?.submissions ?? []).filter((s) => filter === "all" || (filter === "reported" ? s.open_reports > 0 : s.status === filter));
  const reports = (data?.reports ?? []).filter((r) => r.status === "open");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">{["pending", "approved", "rejected", "withdrawn", "removed", "reported", "all"].map((f) => (
        <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">{f}</Button>))}</div>
      {!subs.length && <p className="text-sm text-muted-foreground">Nothing here.</p>}
      {subs.map((s) => (
        <div key={s.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-full sm:w-64">
              {preview === s.id ? <iframe className="aspect-video w-full rounded-lg" src={embedUrl(s.youtube_video_id)} title={s.title} allowFullScreen />
                : <button onClick={() => setPreview(s.id)} className="block w-full"><img src={`https://i.ytimg.com/vi/${s.youtube_video_id}/hqdefault.jpg`} alt="" className="aspect-video w-full rounded-lg object-cover" /></button>}
              <a className="mt-1 block text-xs text-primary underline" href={watchUrl(s.youtube_video_id)} target="_blank" rel="noopener noreferrer">Open on YouTube</a>
            </div>
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              <p className="font-bold">{s.title} {s.featured && <span className="text-primary">· Featured</span>}</p>
              <p className="text-muted-foreground">{s.status} · {s.verified_vydora ? "Published via Vydora" : "Not verified as Vydora-made"} · {s.open_reports} open reports</p>
              <p>{s.display_name || "—"} · <a className="underline" href={s.channel_url} target="_blank" rel="noopener noreferrer">{s.channel_name}</a> · {s.email}</p>
              <select className="rounded-md border border-input bg-background px-2 py-1" value={s.category} onChange={(e) => act(s.id, "edit", { _category: e.target.value })}>
                {COMMUNITY_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
              <textarea className="w-full rounded-md border border-input bg-background p-2" defaultValue={s.description} maxLength={1000}
                onBlur={(e) => e.target.value !== s.description && act(s.id, "edit", { _description: e.target.value })} />
              <details className="text-xs text-muted-foreground"><summary>Consent and history</summary>
                <p>Consent given {fmt(s.consent_at)}: “{s.consent_text}”</p>
                <p>Submitted {fmt(s.created_at)} · Reviewed {fmt(s.reviewed_at)}{s.review_note ? ` (${s.review_note})` : ""} · Withdrawn {fmt(s.withdrawn_at ?? s.consent_withdrawn_at)}</p>
              </details>
              <div className="flex flex-wrap gap-2 pt-2">
                {s.status !== "approved" && s.status !== "withdrawn" && <Button size="sm" onClick={() => act(s.id, "approve")}>Approve</Button>}
                {s.status !== "rejected" && s.status !== "withdrawn" && <Button size="sm" variant="outline" onClick={() => act(s.id, "reject", { _note: window.prompt("Reason shown to the creator (optional)") ?? undefined })}>Reject</Button>}
                {s.status === "approved" && <Button size="sm" variant="outline" onClick={() => act(s.id, s.featured ? "unfeature" : "feature")}>{s.featured ? "Unfeature" : "Feature"}</Button>}
                {s.status === "approved" && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => act(s.id, "remove")}>Remove from gallery</Button>}
              </div>
            </div>
          </div>
        </div>))}
      <div><h3 className="font-bold">Open reports</h3>
        {!reports.length ? <p className="text-sm text-muted-foreground">No open reports.</p> : reports.map((r) => (
          <div key={r.id} className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm">
            <div className="flex-1"><p className="font-medium">{r.title}</p><p className="text-muted-foreground">{r.reason}{r.details ? ` — ${r.details}` : ""} · {fmt(r.created_at)}</p></div>
            <Button size="sm" variant="outline" onClick={async () => { await supabase.rpc("admin_community_report_done", { _id: r.id }); qc.invalidateQueries({ queryKey: ["admin-community"] }); }}>Mark reviewed</Button>
          </div>))}
      </div>
      <p className="text-xs text-muted-foreground">Categories: {COMMUNITY_CATEGORIES.map((c) => categoryLabel(c.id)).join(", ")}</p>
    </div>
  );
}

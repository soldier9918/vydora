import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const rpc = async (name: string, args?: Record<string, unknown>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) throw error;
  return data as Any;
};
const Pill = ({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted"; children: React.ReactNode }) => (
  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${tone === "ok" ? "bg-primary/15 text-primary" : tone === "bad" ? "bg-destructive/15 text-destructive" : tone === "warn" ? "bg-accent/20 text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{children}</span>
);

/* 1. Feedback inbox */
const FB_STATUS: Record<string, string> = { new: "New", in_review: "In review", resolved: "Resolved" };
export function FeedbackPanel() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const q = useQuery({ queryKey: ["admin-feedback"], queryFn: () => rpc("admin_feedback") });
  const rows = ((q.data ?? []) as Any[]).filter((f) => filter === "all" || f.status === filter);
  const setStatus = async (id: string, status: string) => {
    try { await rpc("admin_set_feedback_status", { _id: id, _status: status }); qc.invalidateQueries({ queryKey: ["admin-feedback"] }); }
    catch (e) { toast.error((e as Error).message); }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {["all", "new", "in_review", "resolved"].map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
            {s === "all" ? "All" : FB_STATUS[s]} ({((q.data ?? []) as Any[]).filter((f) => s === "all" || f.status === s).length})
          </Button>
        ))}
      </div>
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!q.isLoading && !rows.length && <p className="text-sm text-muted-foreground">No feedback here yet.</p>}
      {rows.map((f) => (
        <div key={f.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Pill tone={f.status === "resolved" ? "ok" : f.status === "new" ? "bad" : "warn"}>{FB_STATUS[f.status] ?? f.status}</Pill>
            <span className="font-semibold uppercase">{f.category}</span>
            <span>{fmt(f.created_at)}</span>
            <span>{f.email || f.account_email || "Anonymous"}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm">{f.message}</p>
          <div className="mt-3 flex gap-2">
            {Object.keys(FB_STATUS).filter((s) => s !== f.status).map((s) => (
              <Button key={s} size="sm" variant="outline" onClick={() => setStatus(f.id, s)}>Mark {FB_STATUS[s].toLowerCase()}</Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* 2. Autopilot & cloud render queue */
export function AutopilotQueuePanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-queue"], queryFn: () => rpc("admin_autopilot_queue"), refetchInterval: 15000 });
  const d = q.data ?? {};
  const lastSeen = d.worker?.last_seen ? new Date(d.worker.last_seen) : null;
  const active = ((d.renders ?? []) as Any[]).some((r) => ["rendering", "generating", "uploading"].includes(r.status)) ||
    ((d.plans ?? []) as Any[]).some((p) => p.run_status === "generating");
  const mins = lastSeen ? Math.round((Date.now() - lastSeen.getTime()) / 60000) : null;
  const retry = async (id: string) => {
    try { const ok = await rpc("admin_retry_autopilot_plan", { _plan: id }); toast[ok ? "success" : "error"](ok ? "Queued again" : "This plan can't be retried");
      qc.invalidateQueries({ queryKey: ["admin-queue"] }); } catch (e) { toast.error((e as Error).message); }
  };
  const plans = (d.plans ?? []) as Any[];
  const counts = plans.reduce((m: Record<string, number>, p) => ((m[p.status] = (m[p.status] ?? 0) + 1), m), {});
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Rendering worker</p>
          <p className="mt-1 text-lg font-bold">{d.worker?.locked_by ?? "Not seen yet"}</p>
          <p className="text-xs text-muted-foreground">
            {lastSeen ? `Last job activity ${mins} Minutes ago` : "No jobs handled yet"}{active ? " · working now" : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">The worker only reports in while it's handling a job, so a quiet worker is normal when nothing is queued.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 sm:col-span-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Autopilot plans</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(counts).map(([k, v]) => <Pill key={k} tone={k === "failed" ? "bad" : k === "done" || k === "completed" ? "ok" : "muted"}>{k}: {v as number}</Pill>)}
            {!plans.length && <span className="text-sm text-muted-foreground">No plans yet.</span>}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>{["Topic", "User", "Make at", "Status", "Progress", "Problem", ""].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="border-t border-border align-top">
                <td className="px-3 py-2 font-medium">{p.topic}</td>
                <td className="px-3 py-2">{p.email}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmt(p.create_on)}</td>
                <td className="px-3 py-2"><Pill tone={p.status === "failed" ? "bad" : p.status === "done" ? "ok" : "muted"}>{p.status}</Pill>{p.attempts ? <p className="text-xs text-muted-foreground">attempt {p.attempts}</p> : null}</td>
                <td className="px-3 py-2 w-32">{p.progress != null ? <div className="flex items-center gap-2"><Progress value={p.progress} className="h-2" /><span className="text-xs">{p.progress}%</span></div> : "—"}</td>
                <td className="px-3 py-2 max-w-xs text-xs text-destructive">{p.run_error || p.render_error || (p.status === "failed" || p.status === "skipped" ? p.note : "")}</td>
                <td className="px-3 py-2">{["failed", "skipped"].includes(p.status) && p.cloud && <Button size="sm" variant="outline" onClick={() => retry(p.id)}>Retry</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm font-semibold">Recent cloud renders</p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>{["Started", "User", "Type", "Status", "Progress", "Credits", "Problem"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {((d.renders ?? []) as Any[]).map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 whitespace-nowrap">{fmt(r.created_at)}</td>
                <td className="px-3 py-2">{r.email}</td>
                <td className="px-3 py-2">{r.kind}</td>
                <td className="px-3 py-2"><Pill tone={r.status === "failed" ? "bad" : r.status === "completed" ? "ok" : "muted"}>{r.status}</Pill></td>
                <td className="px-3 py-2">{r.progress}%</td>
                <td className="px-3 py-2">{r.credits_charged}{r.credits_refunded ? " (refunded)" : ""}</td>
                <td className="px-3 py-2 max-w-xs text-xs text-destructive">{r.error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Failed cloud renders give their credits back automatically, once. Refreshes every 15 Seconds.</p>
    </div>
  );
}

/* 3. Customer support drawer */
export function UserDetailSheet({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [amt, setAmt] = useState("");
  const q = useQuery({ queryKey: ["admin-user", userId], enabled: !!userId, queryFn: () => rpc("admin_user_detail", { _user: userId }) });
  const d = q.data;
  const adjust = async () => {
    const n = parseInt(amt, 10);
    if (!n) return toast.error("Enter a non-zero number of credits");
    try { await rpc("admin_adjust_credits", { _user: userId, _amount: n, _note: "support" });
      toast.success(`${n > 0 ? "Added" : "Removed"} ${Math.abs(n)} credits`); setAmt("");
      qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith("admin-") }); }
    catch (e) { toast.error((e as Error).message); }
  };
  return (
    <Sheet open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>{d?.email ?? "Loading…"}</SheetTitle></SheetHeader>
        {d && (
          <div className="mt-4 space-y-5 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Balance</p><p className="text-xl font-bold">{d.balance}</p></div>
              <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Plan</p>
                <p className="text-xl font-bold capitalize">{d.subscription?.plan ?? "Free"}</p>
                {d.subscription && <p className="text-xs text-muted-foreground">{d.subscription.status}{d.subscription.cancel_at_period_end ? " · ends" : " · renews"} {fmt(d.subscription.period_end)}</p>}
              </div>
            </div>
            <div>
              <p className="font-semibold">YouTube</p>
              <p className="text-muted-foreground">{d.youtube ? `${d.youtube.channel} · connected ${fmt(d.youtube.connected_at)}` : "Not connected"}</p>
            </div>
            {d.subscription?.customer && (
              <a className="text-primary underline" target="_blank" rel="noreferrer" href={`https://dashboard.stripe.com/customers/${d.subscription.customer}`}>Open in Stripe</a>
            )}
            <div>
              <p className="font-semibold">Adjust credits</p>
              <div className="mt-2 flex gap-2">
                <input className="h-9 w-28 rounded-md border border-input bg-background px-2" placeholder="+50 or -20" value={amt} onChange={(e) => setAmt(e.target.value)} />
                <Button size="sm" onClick={adjust}>Apply</Button>
              </div>
            </div>
            <div>
              <p className="font-semibold">Videos ({d.videos.length})</p>
              <ul className="mt-2 space-y-1">
                {(d.videos as Any[]).map((v) => <li key={v.id} className="flex justify-between gap-2 border-b border-border py-1"><span className="truncate">{v.title}</span><span className="shrink-0 text-xs text-muted-foreground">{v.aspect_ratio} · {fmt(v.created_at)}</span></li>)}
                {!d.videos.length && <li className="text-muted-foreground">No videos yet.</li>}
              </ul>
            </div>
            <div>
              <p className="font-semibold">Credit history</p>
              <ul className="mt-2 space-y-1">
                {(d.ledger as Any[]).map((l, i) => <li key={i} className="flex justify-between gap-2 border-b border-border py-1"><span>{l.reason.replace(/_/g, " ")}</span><span className={l.amount < 0 ? "text-destructive" : "text-primary"}>{l.amount > 0 ? "+" : ""}{l.amount}</span><span className="text-xs text-muted-foreground">{fmt(l.created_at)}</span></li>)}
              </ul>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* 4. Health bar */
export function HealthBar() {
  const q = useQuery({ queryKey: ["admin-health"], queryFn: () => rpc("admin_health"), refetchInterval: 60000 });
  const d = q.data;
  if (!d) return null;
  const items: [string, { total: number; failed: number }][] = [["Downloads", d.exports], ["Cloud renders", d.cloud_renders], ["Autopilot", d.autopilot], ["YouTube uploads", d.youtube]];
  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">Health, last 24 Hours</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {items.map(([label, s]) => {
          const rate = s.total ? s.failed / s.total : 0;
          const tone = !s.total ? "muted" : rate > 0.25 ? "bad" : rate > 0 ? "warn" : "ok";
          return <div key={label} className="flex items-center gap-2"><Pill tone={tone}>{!s.total ? "idle" : tone === "ok" ? "OK" : tone === "warn" ? "Some failures" : "Problem"}</Pill><span className="text-sm">{label}: {s.failed} failed of {s.total}</span></div>;
        })}
        <div className="flex items-center gap-2"><Pill tone={d.spends && d.refunds / d.spends > 0.25 ? "bad" : "muted"}>{d.refunds} refunds</Pill><span className="text-sm">of {d.spends} paid AI actions (high refunds = AI service trouble)</span></div>
      </div>
    </div>
  );
}

/* 5. Hidden test accounts */
export function HiddenAccountsPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-hidden"], queryFn: () => rpc("admin_hidden_list") });
  const unhide = async (id: string) => {
    try { await rpc("admin_set_user_hidden", { _user: id, _hidden: false }); toast.success("Account shown again");
      qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith("admin-") }); } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">These accounts are left out of every list and stat. Hide more from the Users tab with the "Hide" button. Nothing is deleted.</p>
      {((q.data ?? []) as Any[]).map((h) => (
        <div key={h.user_id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <span>{h.email ?? h.user_id}<span className="ml-2 text-xs text-muted-foreground">hidden {fmt(h.hidden_at)}</span></span>
          <Button size="sm" variant="outline" onClick={() => unhide(h.user_id)}>Show again</Button>
        </div>
      ))}
      {q.data && !q.data.length && <p className="text-sm text-muted-foreground">No hidden accounts.</p>}
    </div>
  );
}

export async function hideUser(id: string) {
  await rpc("admin_set_user_hidden", { _user: id, _hidden: true });
}

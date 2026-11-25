import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { gbp } from "@/lib/paymentValue";
import { ACTION_LABELS, FIXED_MONTHLY, actionCost, fixedFor, totalsByTier, type UsageRow } from "@/lib/usageCosts";

const f = (n: number) => n.toFixed(2);

export default function AdminCostsPanel() {
  const [days, setDays] = useState(30);
  const q = useQuery({
    queryKey: ["admin-usage-costs", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_usage_costs" as never, { _days: days } as never);
      if (error) throw error;
      return data as unknown as { actions: UsageRow[]; revenue_pence: number };
    },
  });
  const rows = q.data?.actions ?? [];
  const t = totalsByTier(rows);
  const fixed = fixedFor(days);
  const byAction = new Map<string, { free: number; paid: number; admin: number; n: number }>();
  for (const r of rows) {
    const e = byAction.get(r.action) ?? { free: 0, paid: 0, admin: 0, n: 0 };
    e[r.tier] += actionCost(r); e.n += r.n; byAction.set(r.action, e);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDays(d)}
            className={`rounded-md border px-3 py-1 text-sm ${d === days ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
            Last {d} days
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Estimates in Lovable credits, based on measured average costs per action. Your exact bill is in Lovable's usage settings.
      </p>
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {q.error && <p className="text-sm text-destructive">Couldn't load costs.</p>}
      {q.data && (
        <>
          <div className="grid gap-3 sm:grid-cols-5">
            {[
              ["Free users", t.free], ["Paid users", t.paid], ["Admin / testing", t.admin],
              ["Running costs", fixed], ["Total estimate", t.free + t.paid + t.admin + fixed],
            ].map(([l, v]) => (
              <div key={l as string} className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">{l}</p>
                <p className="text-lg font-semibold">{f(v as number)}</p>
              </div>
            ))}
          </div>
          <p className="text-sm">Real money in (same period): <b>{gbp(q.data.revenue_pence / 100)}</b></p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>
                <th className="p-2">What</th><th className="p-2">Times used</th><th className="p-2">Free</th><th className="p-2">Paid</th><th className="p-2">Admin</th>
              </tr></thead>
              <tbody>
                {[...byAction.entries()].map(([a, e]) => (
                  <tr key={a} className="border-t border-border">
                    <td className="p-2">{ACTION_LABELS[a] ?? a}</td><td className="p-2">{e.n}</td>
                    <td className="p-2">{f(e.free)}</td><td className="p-2">{f(e.paid)}</td><td className="p-2">{f(e.admin)}</td>
                  </tr>
                ))}
                {Object.entries(FIXED_MONTHLY).map(([l, v]) => (
                  <tr key={l} className="border-t border-border text-muted-foreground">
                    <td className="p-2">{l}</td><td className="p-2">—</td><td className="p-2" colSpan={3}>{f((v * days) / 30)} (shared)</td>
                  </tr>
                ))}
                {!rows.length && <tr><td className="p-2 text-muted-foreground" colSpan={5}>No paid actions in this period.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

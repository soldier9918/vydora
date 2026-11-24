import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserDetailSheet } from "@/components/AdminTools";
import { refundStatus, failureCsv } from "@/lib/exportFailureReport";

const fmt = (date: string) => new Date(date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default function AdminFailedExportsPanel() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<string | null>(null);
  const failures = useQuery({
    queryKey: ["admin-failed-exports", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_failed_exports", { _limit: 500 });
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = (failures.data ?? []).filter((row) =>
    `${row.email ?? ""} ${row.title ?? ""} ${row.video_id}`.toLowerCase().includes(search.trim().toLowerCase()));
  const download = () => {
    const url = URL.createObjectURL(new Blob([failureCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "vydora-failed-downloads.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section aria-label="Failed downloads">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input aria-label="Search failed downloads" placeholder="Search user or video" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Button variant="secondary" onClick={download} disabled={!rows.length}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        <Button variant="outline" aria-label="Refresh failed downloads" title="Refresh failed downloads" disabled={failures.isFetching} onClick={() => failures.refetch()}><RefreshCw className="h-4 w-4" /></Button>
        <span className="text-sm text-muted-foreground">{rows.length} shown · latest 500 attempts</span>
      </div>
      {failures.isError ? <p role="alert" className="py-4 text-sm text-destructive">Could not load failed downloads. Please refresh.</p> :
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>{["Attempt started", "Failed at", "User", "Video", "Source", "Quality / format", "Failure reason", "Credits"].map((heading) => <th key={heading} className="px-3 py-2">{heading}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row) => <tr key={`${row.source}:${row.id}`} className="border-t border-border align-top">
                <td className="whitespace-nowrap px-3 py-3">{fmt(row.created_at)}</td>
                <td className="whitespace-nowrap px-3 py-3">{row.failed_at ? fmt(row.failed_at) : "Not recorded"}</td>
                <td className="px-3 py-3"><Button variant="link" className="h-auto max-w-64 whitespace-normal break-words p-0 text-left" onClick={() => setDetail(row.user_id)}>{row.email || "Deleted account"}</Button></td>
                <td className="min-w-48 max-w-72 break-words px-3 py-3"><p className="font-medium" dir="auto">{row.title || "Deleted video"}</p><p className="mt-1 break-all text-xs text-muted-foreground">{row.video_id}</p></td>
                <td className="px-3 py-3">{row.source === "cloud" ? "Cloud render" : "Browser export"}</td>
                <td className="whitespace-nowrap px-3 py-3">{row.quality || "—"} · {row.format.toUpperCase()}</td>
                <td className="min-w-56 max-w-96 break-words px-3 py-3">{row.error_message || "No reason recorded for this attempt."}</td>
                <td className="whitespace-nowrap px-3 py-3">{refundStatus(row)}</td>
              </tr>)}
              {failures.isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
              {!failures.isLoading && !rows.length && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">{search ? "No matching failed downloads." : "No failed downloads recorded."}</td></tr>}
            </tbody>
          </table>
        </div>}
      <UserDetailSheet userId={detail} onClose={() => setDetail(null)} />
    </section>
  );
}
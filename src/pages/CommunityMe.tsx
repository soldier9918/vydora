import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { confirmDialog } from "@/components/ConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { categoryLabel, isYouTubeChannel } from "@/lib/community";

const STATUS: Record<string, string> = { pending: "Waiting for review", approved: "Live in the showcase", rejected: "Not accepted", withdrawn: "Removed by you", removed: "Removed by Vydora" };

export default function CommunityMe() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const subs = useQuery({ queryKey: ["community-mine", user?.id], enabled: !!user, queryFn: async () =>
    (await supabase.from("community_submissions").select("id,title,category,status,created_at,review_note").order("created_at", { ascending: false })).data ?? [] });
  const prof = useQuery({ queryKey: ["community-me", user?.id], enabled: !!user, queryFn: async () =>
    (await supabase.from("community_creators").select("*").maybeSingle()).data });
  const [p, setP] = useState({ display_name: "", channel_name: "", channel_url: "", bio: "", avatar_url: "" });
  useEffect(() => { if (prof.data) setP({ display_name: prof.data.display_name, channel_name: prof.data.channel_name, channel_url: prof.data.channel_url, bio: prof.data.bio, avatar_url: prof.data.avatar_url ?? "" }); }, [prof.data]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["community-mine"] }); qc.invalidateQueries({ queryKey: ["community-me"] }); qc.invalidateQueries({ queryKey: ["community-gallery"] }); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isYouTubeChannel(p.channel_url)) return toast.error("Add a valid YouTube channel link.");
    const { error } = await supabase.rpc("community_update_profile", { _display_name: p.display_name, _channel_name: p.channel_name, _channel_url: p.channel_url.trim(), _bio: p.bio, _avatar_url: p.avatar_url.trim() });
    if (error) toast.error(error.message); else { toast.success("Profile saved"); refresh(); }
  };
  const withdraw = async (id: string) => {
    if (!(await confirmDialog({ title: "Remove this video from the showcase?", message: "It disappears from the public gallery straight away." }))) return;
    const { error } = await supabase.rpc("community_withdraw", { _id: id }); if (error) toast.error(error.message); else { toast.success("Removed"); refresh(); }
  };
  const withdrawAll = async () => {
    if (!(await confirmDialog({ title: "Withdraw consent?", message: "All your videos and your creator profile are removed from the public showcase." }))) return;
    const { error } = await supabase.rpc("community_withdraw_all"); if (error) toast.error(error.message); else { toast.success("Consent withdrawn"); refresh(); }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container max-w-4xl py-10">
        <Link to="/community" className="text-sm text-muted-foreground hover:text-primary">← Community Showcase</Link>
        <h1 className="mt-3 text-3xl font-extrabold">My Community profile</h1>
        {prof.data && !prof.data.consent_withdrawn_at && <p className="mt-1 text-sm text-muted-foreground">Public profile: <Link className="text-primary underline" to={`/community/creator/${prof.data.slug}`}>/community/creator/{prof.data.slug}</Link> (shows once a video is approved)</p>}
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold">My submissions</h2>
          {!subs.data?.length ? <p className="mt-2 text-sm text-muted-foreground">No submissions yet. <Link to="/community?submit=1" className="text-primary underline">Submit a video</Link></p> : (
            <ul className="mt-3 divide-y divide-border">{subs.data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{categoryLabel(s.category)} · {STATUS[s.status] ?? s.status}{s.review_note ? ` · ${s.review_note}` : ""}</p></div>
                {s.status !== "withdrawn" && <Button size="sm" variant="outline" onClick={() => withdraw(s.id)}>Remove</Button>}
              </li>))}</ul>)}
        </section>
        <form onSubmit={save} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold">Public creator details</h2>
          <p className="text-sm text-muted-foreground">Your email is never shown.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Display name</Label><Input maxLength={60} value={p.display_name} onChange={(e) => setP({ ...p, display_name: e.target.value })} /></div>
            <div><Label>Channel name</Label><Input maxLength={80} value={p.channel_name} onChange={(e) => setP({ ...p, channel_name: e.target.value })} /></div>
          </div>
          <div><Label>YouTube channel link</Label><Input value={p.channel_url} onChange={(e) => setP({ ...p, channel_url: e.target.value })} placeholder="https://www.youtube.com/@yourchannel" /></div>
          <div><Label>Picture link (optional)</Label><Input value={p.avatar_url} onChange={(e) => setP({ ...p, avatar_url: e.target.value })} placeholder="https://…" /></div>
          <div><Label>Short bio</Label><Textarea maxLength={400} value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value })} /></div>
          <div className="flex flex-wrap gap-2"><Button type="submit">Save profile</Button>
            {prof.data && <Button type="button" variant="ghost" className="text-destructive" onClick={withdrawAll}>Withdraw consent and remove everything</Button>}</div>
        </form>
      </main>
    </div>
  );
}

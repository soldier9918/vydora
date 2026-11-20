import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { COMMUNITY_CATEGORIES, CONSENT_TEXT, checkEmbeddable, isYouTubeChannel, parseYouTubeVideo, watchUrl } from "@/lib/community";

type Props = { open: boolean; onClose: () => void; videoId?: string; defaults?: { title?: string; description?: string } };

export default function SubmitDialog({ open, onClose, videoId, defaults }: Props) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [f, setF] = useState({ video: videoId ?? "", url: "", title: defaults?.title ?? "", category: "", description: defaults?.description ?? "", channelUrl: "", channelName: "", name: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  useEffect(() => {
    if (!open || !user) return;
    supabase.from("videos").select("id,title").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setProjects(data ?? []));
    supabase.from("community_creators").select("display_name,channel_name,channel_url").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => data && setF((s) => ({ ...s, name: s.name || data.display_name, channelName: s.channelName || data.channel_name, channelUrl: s.channelUrl || data.channel_url })));
  }, [open, user]);

  // Prefill the YouTube link when the chosen project was published through Vydora.
  useEffect(() => {
    if (!f.video || !user) return;
    supabase.from("youtube_uploads").select("youtube_video_id").eq("video_id", f.video).not("youtube_video_id", "is", null).order("created_at", { ascending: false }).limit(1)
      .then(({ data }) => { const id = data?.[0]?.youtube_video_id; if (id) setF((s) => ({ ...s, url: s.url || watchUrl(id) })); });
    const p = projects.find((x) => x.id === f.video);
    if (p) setF((s) => ({ ...s, title: s.title || p.title }));
  }, [f.video, user, projects]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const yt = parseYouTubeVideo(f.url);
    if (!yt) return toast.error("Paste a public YouTube video link, like https://www.youtube.com/watch?v=…");
    if (!isYouTubeChannel(f.channelUrl)) return toast.error("Paste your YouTube channel link, like https://www.youtube.com/@yourchannel");
    if (!f.category) return toast.error("Choose a category.");
    if (!consent) return toast.error("Please tick the consent box to submit.");
    setBusy(true);
    const embed = await checkEmbeddable(yt.id);
    if (!embed.ok) { setBusy(false); return toast.error("That video isn't public or can't be played on other sites. Check its YouTube settings and try again."); }
    const { error } = await supabase.rpc("community_submit", {
      _youtube_id: yt.id, _title: f.title, _description: f.description, _category: f.category, _is_short: yt.isShort || f.category === "shorts",
      _video: f.video || null as unknown as string, _display_name: f.name, _channel_name: f.channelName || embed.author || "", _channel_url: f.channelUrl.trim(),
      _consent: consent, _consent_text: CONSENT_TEXT });
    setBusy(false);
    if (error) return toast.error(error.message);
    setDone(true);
  };

  const close = () => { setDone(false); setConsent(false); onClose(); };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{done ? "Submitted" : "Submit your video"}</DialogTitle>
          {!done && <DialogDescription>Free to submit. Our team reviews every video before it appears in the showcase.</DialogDescription>}
        </DialogHeader>
        {done ? (
          <div className="space-y-4"><p>Thank you! Your video has been submitted for review.</p>
            <p className="text-sm text-muted-foreground">You can see its status or remove it any time from your <Link className="text-primary underline" to="/community/me" onClick={close}>Community profile</Link>.</p>
            <Button onClick={close}>Close</Button></div>
        ) : !user ? (
          <div className="space-y-3"><p className="text-sm text-muted-foreground">Sign in to your Vydora account to submit a video.</p>
            <Button asChild><Link to="/auth?next=/community">Sign in</Link></Button></div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div><Label htmlFor="cs-proj">Vydora project (optional)</Label>
              <select id="cs-proj" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={f.video} onChange={set("video")}>
                <option value="">Not linked to a project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select></div>
            <div><Label htmlFor="cs-url">Public YouTube video link</Label><Input id="cs-url" required inputMode="url" placeholder="https://www.youtube.com/watch?v=…" value={f.url} onChange={set("url")} /></div>
            <div><Label htmlFor="cs-title">Video title</Label><Input id="cs-title" required minLength={3} maxLength={120} value={f.title} onChange={set("title")} /></div>
            <div><Label htmlFor="cs-cat">Category</Label>
              <select id="cs-cat" required className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={f.category} onChange={set("category")}>
                <option value="" disabled>Choose a category</option>
                {COMMUNITY_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select></div>
            <div><Label htmlFor="cs-desc">Description</Label><Textarea id="cs-desc" maxLength={1000} value={f.description} onChange={set("description")} /></div>
            <div><Label htmlFor="cs-ch">YouTube channel link</Label><Input id="cs-ch" required inputMode="url" placeholder="https://www.youtube.com/@yourchannel" value={f.channelUrl} onChange={set("channelUrl")} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="cs-chn">Channel name</Label><Input id="cs-chn" maxLength={80} value={f.channelName} onChange={set("channelName")} /></div>
              <div><Label htmlFor="cs-name">Public display name (optional)</Label><Input id="cs-name" maxLength={60} value={f.name} onChange={set("name")} /></div>
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" aria-required />
              <span>{CONSENT_TEXT}</span>
            </label>
            <Button type="submit" className="w-full" disabled={busy || !consent}>{busy ? "Checking…" : "Submit for review"}</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BadgeCheck, Flag, Share2, Youtube } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { categoryLabel, embedUrl, safeChannelHref, watchUrl, type GalleryItem } from "@/lib/community";

const REASONS = [["not_mine", "Uses my video or channel without permission"], ["inappropriate", "Inappropriate content"], ["misleading", "Misleading"], ["spam", "Spam"], ["other", "Something else"]] as const;

export default function VideoDialog({ item, onClose }: { item: GalleryItem | null; onClose: () => void }) {
  const { user } = useAuth();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<string>("inappropriate");
  const [details, setDetails] = useState("");
  if (!item) return null;
  const channel = safeChannelHref(item.channel_url);
  const share = async () => {
    const url = `${window.location.origin}/community?v=${item.id}`;
    try { if (navigator.share) await navigator.share({ title: item.title, url }); else { await navigator.clipboard.writeText(url); toast.success("Link copied"); } } catch { /* cancelled */ }
  };
  const report = async () => {
    const { error } = await supabase.rpc("community_report", { _id: item.id, _reason: reason, _details: details });
    if (error) return toast.error(error.message);
    toast.success("Thanks — our team will review this video."); setReporting(false); setDetails("");
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6">{item.title}</DialogTitle>
          <DialogDescription>{categoryLabel(item.category)}{item.verified_vydora && " · Published to YouTube with Vydora"}</DialogDescription>
        </DialogHeader>
        <div className={`overflow-hidden rounded-xl bg-muted ${item.is_short ? "mx-auto aspect-[9/16] max-h-[60vh]" : "aspect-video"}`}>
          <iframe className="h-full w-full" src={embedUrl(item.youtube_video_id)} title={item.title} loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
        </div>
        {item.description && <p className="whitespace-pre-line text-sm text-muted-foreground">{item.description}</p>}
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
          {item.creator_avatar ? <img src={item.creator_avatar} alt="" className="h-10 w-10 rounded-full object-cover" referrerPolicy="no-referrer" />
            : <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 font-bold text-primary">{(item.creator_name ?? item.channel_name).charAt(0).toUpperCase()}</span>}
          <div className="min-w-0">
            <Link to={`/community/creator/${item.creator_slug}`} onClick={onClose} className="block truncate font-semibold hover:text-primary">{item.creator_name ?? item.channel_name}</Link>
            <p className="truncate text-xs text-muted-foreground">{item.channel_name}</p>
          </div>
          {item.verified_vydora && <BadgeCheck className="ml-auto h-5 w-5 shrink-0 text-primary" aria-label="Published with Vydora" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild><a href={watchUrl(item.youtube_video_id)} target="_blank" rel="noopener noreferrer nofollow"><Youtube className="h-4 w-4" />Watch on YouTube</a></Button>
          {channel && <Button variant="outline" asChild><a href={channel} target="_blank" rel="noopener noreferrer nofollow">Visit YouTube Channel</a></Button>}
          <Button variant="ghost" onClick={share}><Share2 className="h-4 w-4" />Share</Button>
          <Button variant="ghost" className="ml-auto text-muted-foreground" onClick={() => setReporting((r) => !r)}><Flag className="h-4 w-4" />Report video</Button>
        </div>
        {reporting && (user ? (
          <div className="space-y-2 rounded-xl border border-border p-3">
            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <Textarea maxLength={1000} placeholder="Anything else we should know? (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
            <Button size="sm" onClick={report}>Send report</Button>
          </div>
        ) : <p className="text-sm text-muted-foreground"><Link className="text-primary underline" to="/auth?next=/community">Sign in</Link> to report a video.</p>)}
      </DialogContent>
    </Dialog>
  );
}

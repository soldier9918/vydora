import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import VideoCard from "@/components/community/VideoCard";
import VideoDialog from "@/components/community/VideoDialog";
import { useGallery } from "@/pages/Community";
import { safeChannelHref, type GalleryItem } from "@/lib/community";

export default function CommunityCreator() {
  const { slug = "" } = useParams();
  const { data = [], isLoading } = useGallery(slug);
  const [open, setOpen] = useState<GalleryItem | null>(null);
  const c = data[0];
  const channel = c ? safeChannelHref(c.channel_url) : null;
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container max-w-6xl py-10">
        <Link to="/community" className="text-sm text-muted-foreground hover:text-primary">← Community Showcase</Link>
        {isLoading ? <p className="mt-8 text-muted-foreground">Loading…</p> : !c ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-10 text-center"><h1 className="text-2xl font-bold">Creator not found</h1>
            <p className="mt-2 text-muted-foreground">This creator has no showcased videos right now.</p></div>
        ) : (
          <>
            <section className="mt-6 flex flex-col items-start gap-5 rounded-3xl border border-border bg-card p-6 sm:flex-row sm:items-center">
              {c.creator_avatar ? <img src={c.creator_avatar} alt="" className="h-20 w-20 rounded-full object-cover" referrerPolicy="no-referrer" />
                : <span className="grid h-20 w-20 place-items-center rounded-full bg-primary/15 text-3xl font-bold text-primary">{(c.creator_name ?? c.channel_name).charAt(0).toUpperCase()}</span>}
              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-extrabold">{c.creator_name ?? c.channel_name}</h1>
                <p className="text-muted-foreground">{c.channel_name}</p>
                {c.creator_bio && <p className="mt-2 max-w-2xl text-sm">{c.creator_bio}</p>}
              </div>
              {channel && <Button asChild><a href={channel} target="_blank" rel="noopener noreferrer nofollow">Visit YouTube Channel</a></Button>}
            </section>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data.map((v) => <VideoCard key={v.id} item={v} onOpen={() => setOpen(v)} />)}</div>
          </>
        )}
      </main>
      <SiteFooter />
      <VideoDialog item={open} onClose={() => setOpen(null)} />
    </div>
  );
}

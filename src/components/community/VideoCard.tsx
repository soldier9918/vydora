import { BadgeCheck, Play, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categoryLabel, safeChannelHref, thumbUrl, type GalleryItem } from "@/lib/community";

export default function VideoCard({ item, onOpen }: { item: GalleryItem; onOpen: () => void }) {
  const channel = safeChannelHref(item.channel_url);
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/60">
      <button onClick={onOpen} className="relative aspect-video overflow-hidden bg-muted" aria-label={`Watch ${item.title}`}>
        <img src={thumbUrl(item.youtube_video_id)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <span className="absolute inset-0 grid place-items-center bg-background/0 transition-colors group-hover:bg-background/30">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100"><Play className="h-5 w-5 fill-current" /></span>
        </span>
        {item.featured && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"><Star className="h-3 w-3 fill-current" />Featured</span>}
      </button>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{categoryLabel(item.category)}</p>
        <h3 className="mt-1 line-clamp-2 font-bold">{item.title}</h3>
        <p className="mt-1 flex items-center gap-1 truncate text-sm text-muted-foreground">
          {item.creator_name ?? item.channel_name}{item.creator_name && <> · {item.channel_name}</>}
          {item.verified_vydora && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Published with Vydora" />}
        </p>
        {item.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>}
        <div className="mt-auto flex gap-2 pt-4">
          <Button size="sm" onClick={onOpen}>Watch Video</Button>
          {channel && <Button size="sm" variant="outline" asChild><a href={channel} target="_blank" rel="noopener noreferrer nofollow">Visit Channel</a></Button>}
        </div>
      </div>
    </article>
  );
}

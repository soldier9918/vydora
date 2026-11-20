import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Sparkles } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VideoCard from "@/components/community/VideoCard";
import VideoDialog from "@/components/community/VideoDialog";
import SubmitDialog from "@/components/community/SubmitDialog";
import { supabase } from "@/integrations/supabase/client";
import { COMMUNITY_CATEGORIES, filterGallery, type GalleryItem } from "@/lib/community";

export const useGallery = (creator?: string) => useQuery({
  queryKey: ["community-gallery", creator ?? null],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("community_gallery", creator ? { _creator: creator } : {});
    if (error) throw error; return (data ?? []) as GalleryItem[];
  },
});

export default function Community() {
  const [params, setParams] = useSearchParams();
  const { data = [], isLoading } = useGallery();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState<"featured" | "newest">("featured");
  const [submitOpen, setSubmitOpen] = useState(params.get("submit") === "1");
  const list = useMemo(() => filterGallery(data, { q, category: cat, sort }), [data, q, cat, sort]);
  const open = data.find((x) => x.id === params.get("v")) ?? null;
  const setOpen = (id: string | null) => { const p = new URLSearchParams(params); if (id) p.set("v", id); else p.delete("v"); setParams(p, { replace: true }); };
  const explore = () => document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container max-w-6xl py-10">
        <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/20 via-card to-card px-6 py-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">The Vydora Community</p>
          <h1 className="mt-4 text-4xl font-extrabold md:text-5xl">Made with Vydora.<br /><span className="text-primary">Shared with the world.</span></h1>
          <p className="mx-auto mt-5 max-w-2xl text-muted-foreground">Explore AI videos created by the Vydora community, discover talented YouTubers, and share your own creations.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={explore}>Explore Videos</Button>
            <Button size="lg" variant="outline" onClick={() => setSubmitOpen(true)}>Submit Your Video</Button>
          </div>
        </section>

        <section id="gallery" className="scroll-mt-20 pt-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative md:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search videos or creators" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search videos" /></div>
            <div className="flex gap-1 rounded-full border border-border p-1 text-sm md:ml-auto">
              {(["featured", "newest"] as const).map((s) => <button key={s} onClick={() => setSort(s)} className={`rounded-full px-3 py-1 ${sort === s ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{s === "featured" ? "Featured" : "Newest"}</button>)}
            </div>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {[{ id: "all", short: "All Videos" }, ...COMMUNITY_CATEGORIES].map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${cat === c.id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>{c.short}</button>
            ))}
          </div>

          {isLoading ? <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="aspect-video animate-pulse rounded-2xl bg-card" />)}</div>
          : list.length ? (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.map((v) => <VideoCard key={v.id} item={v} onOpen={() => setOpen(v.id)} />)}</div>
          ) : (
            <div className="mt-6 rounded-3xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
              <Sparkles className="mx-auto h-10 w-10 text-primary" />
              <h2 className="mt-4 text-2xl font-bold">{data.length ? "No videos match yet" : "Be the first creator in the showcase"}</h2>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">{data.length ? "Try another category or search." : "Made a video with Vydora and posted it on YouTube? Submit it and our team will review it for the showcase."}</p>
              {!data.length && <Button className="mt-6" onClick={() => setSubmitOpen(true)}>Submit Your Video</Button>}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
      <VideoDialog item={open} onClose={() => setOpen(null)} />
      <SubmitDialog open={submitOpen} onClose={() => setSubmitOpen(false)} />
    </div>
  );
}

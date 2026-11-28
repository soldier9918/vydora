import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/hooks/useAuth";
import HeroBackground from "@/components/HeroBackground";
import HeroReel from "@/components/HeroReel";
import HeroDotLogo from "@/components/HeroDotLogo";
import HeroStudio from "@/components/HeroStudio";
import HeroDotGrid from "@/components/HeroDotGrid";
import { useEffect, useRef, useState } from "react";
import CreationTimelapse from "@/components/CreationTimelapse";
import { FEATURE_PAGES } from "@/lib/featurePages";
import TypedHeadline from "@/components/TypedHeadline";
import { Play, Link2, Layers, Search, Film, Smartphone, Music, ArrowRight } from "lucide-react";
import SampleVideos, { HERO_SAMPLE, SampleVideoPlayer, type VideoSample } from "@/components/SampleVideos";

import reelTitanic from "@/assets/reel-titanic.jpg";
import reelEgypt from "@/assets/reel-egypt.jpg";
import reelMars from "@/assets/reel-mars.jpg";
import reelVikings from "@/assets/reel-vikings.jpg";
import reelTokyo from "@/assets/reel-tokyo.jpg";
import reelOcean from "@/assets/reel-ocean.jpg";

const features = [
  { img: reelTitanic, icon: Link2, tag: "Article to Video", t: "Turn any link into a video", d: "Paste a news story or blog post. Vydora pulls out the key points, keeps the sources, and builds a full video.", to: "/from-url" },
  { img: reelEgypt, icon: Layers, tag: "Series", t: "Plan a whole series at once", d: "Pick a topic and get a run of connected episodes with a shared look, each one ready to generate.", to: "/series" },
  { img: reelMars, icon: Search, tag: "Real facts", t: "Scripts backed by sources", d: "Switch on real facts and the script is researched from the web, with every source listed for you to check.", to: "/create" },
  { img: reelVikings, icon: Film, tag: "Animation & B-roll", t: "Bring scenes to life", d: "Animate any scene with AI or drop in free stock footage to keep viewers watching.", to: "/create" },
  { img: reelTokyo, icon: Smartphone, tag: "Shorts remix", t: "One video, two formats", d: "Remix any widescreen video into a vertical Short in one click, using the same scenes and voice.", to: "/create" },
  { img: reelOcean, icon: Music, tag: "Branding & sound", t: "Make it yours", d: "Add your logo, intro and outro cards, background music and the narrator voice and accent you like.", to: "/create" },
];

const steps = [
  { n: "01", t: "Drop an idea", d: "“The rise and fall of Blockbuster” or “5 habits of ancient Stoics.” One line is enough." },
  { n: "02", t: "AI writes & shoots", d: "Vydora writes a hook-first script, then creates a cinematic image for every scene." },
  { n: "03", t: "Voice it, ship it", d: "A natural voiceover is recorded per scene. Preview, tweak, and download your video." },
];

const niches = [
  { t: "History & mystery", to: "/history-documentary-video-maker", d: "Documentary-style videos on unsolved cases, lost civilisations and famous events, with optional real-fact research and sources." },
  { t: "Finance, tech & crypto", to: "/faceless-youtube-channel", d: "Clear explainers on markets, Bitcoin, AI and gadgets, turned from a single idea or a news article link." },
  { t: "Science & space", to: "/text-to-video", d: "Visual stories about planets, the deep sea and big discoveries, with AI images or stock B-roll for every scene." },
  { t: "Shorts & quick facts", to: "/youtube-shorts-maker", d: "Vertical 9:16 videos for YouTube Shorts, or remix any long video into a Short without paying again." },
];

const allInOne = [
  "AI script writing from an idea, a brief or an article link",
  "An image for every scene, plus optional animation or free stock B-roll",
  "Natural AI voiceover with adjustable speed and accent",
  "Captions, background music, intro and outro cards with your logo",
  "Export a YouTube-ready MP4 in 16:9 or 9:16, right in your browser",
];

const faqs = [
  { q: "How does Vydora make a video from one sentence?", a: "You type an idea. Vydora writes a script, splits it into scenes, creates an image and voiceover for each scene and times them together. You can edit any scene, swap images or narration, then download the finished video." },
  { q: "Can I turn an article or blog post into a video?", a: "Yes. Paste a link into Article to Video and Vydora reads the page, writes a narrated script from it and builds the scenes, keeping a link to the original source." },
  { q: "Can I make YouTube Shorts?", a: "Yes. Create videos in vertical 9:16, or use Remix for Shorts to turn an existing video into a Short using the same media, at no extra credit cost." },
  { q: "Do I need video editing experience or software?", a: "No. Everything runs in your web browser. There is nothing to install, and the editor is built for beginners as well as experienced creators." },
  { q: "Can I monetise videos made with Vydora?", a: "You own the videos you create. YouTube decides monetisation based on its own policies, which favour original, valuable content and ask creators to disclose realistic AI content, so add your own ideas, research and voice to every video." },
  { q: "Can Vydora use real facts and sources?", a: "Turn on Use real facts and Vydora researches the topic on the web before writing, then lists the sources so you can check them." },
  { q: "How much does it cost?", a: "Accounts are free, but AI generation requires a top-up from £5 or a paid subscription. Creator is £19 a month with 600 credits and Pro is £49 a month with 2,000 credits." },
];

export default function Landing() {
  const { user } = useAuth();
  const cta = user ? "/create" : "/auth?mode=signup";
  const [sample, setSample] = useState<VideoSample | null>(null);
  // 0 = VYDORA in dots, 1 = dot grid, 2 = thumbnail reel, 3 = AI studio
  const [mode, setMode] = useState(2);
  const headRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const secs = [12000, 8000, 8000, 9000, 9000];
    const id = window.setTimeout(() => setMode((m) => (m + 1) % 5), secs[mode]);
    return () => clearTimeout(id);
  }, [mode]);
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-glow" />
          <div className={`absolute inset-0 transition-opacity duration-[1500ms] ${mode === 1 ? "opacity-100" : "opacity-0"}`}><HeroBackground /></div>
          <div className={`absolute inset-0 transition-opacity duration-[1500ms] ${mode === 2 ? "opacity-100" : "opacity-0"}`}><HeroReel /></div>
          <div className={`absolute inset-0 transition-opacity duration-[1500ms] ${mode === 0 ? "opacity-100" : "opacity-0"}`}><HeroDotLogo active={mode === 0} target={headRef} /></div>
          <div className={`absolute inset-0 transition-opacity duration-[1500ms] ${mode === 3 ? "opacity-100" : "opacity-0"}`}><HeroStudio active={mode === 3} /></div>
          <div className={`absolute inset-0 transition-opacity duration-[1500ms] ${mode === 4 ? "opacity-100" : "opacity-0"}`}><HeroDotGrid /></div>
          <div className="container relative py-20 md:py-32">
            <h1 className="mb-6 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-normal uppercase tracking-widest text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse-dot" /> AI YouTube video generator &amp; faceless video maker
            </h1>
            <div ref={headRef} className={`transition-opacity duration-700 ${mode === 0 ? "invisible opacity-0" : "opacity-100"}`}>{mode !== 0 && <TypedHeadline />}{mode === 0 && <p className="text-5xl md:text-8xl font-extrabold leading-[0.95]" aria-hidden><span className="block">&nbsp;</span><span className="block">&nbsp;</span></p>}</div>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Type an idea or paste an article link. Vydora writes the script, creates a picture for every scene and records the voiceover, then exports a video ready for YouTube. Start generating with a £5 top-up or a subscription.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button size="lg" className="h-12 px-8 text-base shadow-elevated" asChild><Link to={cta}>Create a video</Link></Button>
              <Button size="lg" variant="outline" className="h-12 px-6 text-base" onClick={() => setSample(HERO_SAMPLE)}><Play aria-hidden="true" />Watch 20 Seconds sample</Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild><a href="#how">How it works</a></Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Free account · Make videos from £5 (125 credits) or with a monthly plan · No watermark</p>
          </div>
        </section>

        <section id="how" className="container py-20">
          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="bg-card p-8">
                <span className="font-display text-sm text-accent">{s.n}</span>
                <h3 className="mt-3 text-2xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <SampleVideos onSelect={setSample} />

        <CreationTimelapse />

        <section className="container py-20">
          <div className="mb-10 text-center">
            <p className="text-sm uppercase tracking-widest text-accent">Everything in one studio</p>
            <h2 className="mt-3 text-4xl font-extrabold md:text-5xl">More ways to make videos</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Link key={f.tag} to={user ? f.to : cta} className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50">
                <div className="relative aspect-video overflow-hidden">
                  <img src={f.img} alt={f.t} loading="lazy" width={1280} height={720} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1 text-xs font-semibold backdrop-blur">
                    <f.icon className="h-3.5 w-3.5 text-primary" /> {f.tag}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-xl font-semibold">{f.t}</h3>
                  <p className="mt-2 text-muted-foreground">{f.d}</p>
                  <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-primary">Try it <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="container py-20">
          <div className="mb-10 text-center">
            <p className="text-sm uppercase tracking-widest text-accent">Built for faceless YouTube channels</p>
            <h2 className="mt-3 text-4xl font-extrabold md:text-5xl">Videos for every niche</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">Vydora is an AI YouTube video maker for creators who never show their face. Pick a topic, choose a style and get a narrated, scene-by-scene video ready to upload.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {niches.map((n) => (
              <Link key={n.t} to={n.to} className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary">
                <h3 className="text-lg font-semibold">{n.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{n.d}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="container py-20">
          <div className="grid gap-10 rounded-2xl border border-border bg-card p-8 md:grid-cols-2 md:p-12">
            <div>
              <p className="text-sm uppercase tracking-widest text-accent">One studio, not five tools</p>
              <h2 className="mt-3 text-3xl font-extrabold md:text-4xl">Replace your whole video workflow</h2>
              <p className="mt-4 text-muted-foreground">Making a faceless YouTube video usually means juggling a script writer, an image generator, a voiceover tool, stock footage sites and a video editor. Vydora puts every step in one place, so you go from idea to finished MP4 without copying files between apps.</p>
            </div>
            <ul className="space-y-3">
              {allInOne.map((a) => (
                <li key={a} className="flex gap-3"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" /><span>{a}</span></li>
              ))}
            </ul>
          </div>
        </section>

        <section className="container py-20">
          <div className="mb-10 text-center">
            <p className="text-sm uppercase tracking-widest text-accent">Simple plans</p>
            <h2 className="mt-3 text-4xl font-extrabold md:text-5xl">Start with £5, grow with a plan</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              { t: "Free account", p: "£0", d: "No free AI generations. Top up from £5 to create videos up to 2 Minutes, or subscribe for more." },
              { t: "Creator", p: "£19/month", d: "600 credits a month, videos up to 20 Minutes and more narrators for growing channels." },
              { t: "Pro", p: "£49/month", d: "2,000 credits a month, videos up to 60 Minutes and 1080p exports for long-form channels." },
            ].map((pl) => (
              <div key={pl.t} className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-xl font-semibold">{pl.t}</h3>
                <p className="mt-1 text-2xl font-extrabold text-primary">{pl.p}</p>
                <p className="mt-2 text-sm text-muted-foreground">{pl.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">Credits are used for each AI step (script, images, voiceover), so how many videos you can make depends on their length. Top-ups add credits but don't unlock plan features.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild><Link to={cta}>{user ? "Create a video" : "Create an account"}</Link></Button>
            <Button size="lg" variant="outline" asChild><Link to="/pricing">See what things cost</Link></Button>
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link to="/guides" className="text-primary underline">Free creator guides</Link> · <Link to="/youtube-autopilot" className="text-primary underline">Schedule videos with YouTube Autopilot</Link> · <Link to="/community" className="text-primary underline">See the Community Showcase</Link>
          </p>
          <nav aria-label="Features" className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
            {FEATURE_PAGES.map((f) => <Link key={f.slug} to={`/${f.slug}`} className="text-muted-foreground hover:text-primary">{f.eyebrow}</Link>)}
          </nav>
        </section>

        <section className="container max-w-3xl py-20">
          <div className="mb-10 text-center">
            <h2 className="text-4xl font-extrabold md:text-5xl">Frequently asked questions</h2>
          </div>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {faqs.map((f) => (
              <details key={f.q} className="group p-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  <h3 className="text-lg">{f.q}</h3>
                  <span className="text-2xl text-primary transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="container pb-24">
          <div className="rounded-2xl border border-border bg-card p-10 text-center md:p-16">
            <h2 className="text-4xl font-extrabold md:text-5xl">Your next video is one sentence away.</h2>
            <Button size="lg" className="mt-8 h-12 px-8" asChild><Link to={cta}>Start creating</Link></Button>
          </div>
        </section>
      </main>
      <SiteFooter />
      <SampleVideoPlayer sample={sample} onClose={() => setSample(null)} />
    </div>
  );
}

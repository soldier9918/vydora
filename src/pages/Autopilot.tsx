import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Clapperboard, Download, RotateCcw, Trash2, Youtube } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAccount } from "@/lib/account";
import { toast } from "sonner";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { AUTOPILOT_HELP, autopilotLengthOk, friendlyAutopilotError } from "@/lib/autopilot";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Create, { type PlanSettings } from "@/pages/Create";

const fmt = (d: string) => new Date(d).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const localMin = (ms = 0) => new Date(Date.now() + ms - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export default function Autopilot() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [createOn, setCreateOn] = useState("");
  const [publishOn, setPublishOn] = useState("");
  const cloud = true;
  const { data: acct } = useAccount();
  const [meta, setMeta] = useState<"auto" | "manual">("auto");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [metaTags, setMetaTags] = useState("");
  const [consent, setConsent] = useState(false);
  const { data: access, refetch: refetchAccess } = useQuery({
    queryKey: ["autopilot-access"], enabled: !!user,
    queryFn: async () => ((await supabase.rpc("autopilot_access")).data ?? {}) as { eligible?: boolean; launched?: boolean; subscribed?: boolean; admin?: boolean },
  });
  const canCloud = !!access?.eligible;
  const isAdmin = !!acct?.adminAccess || !!access?.admin;
  const setLaunch = async (on: boolean) => {
    const { error } = await supabase.rpc("admin_set_autopilot_launch", { _enabled: on });
    if (error) toast.error("Couldn't change this."); else { toast.success(on ? "Automatic making is now on for Creator and Pro customers." : "Automatic making is now off for customers."); refetchAccess(); }
  };
  // Hands-off runs: poll while anything is in progress.
  const { data: runs = [] } = useQuery({
    queryKey: ["autopilot-runs"], enabled: !!user, refetchInterval: 15_000,
    queryFn: async () => (await supabase.from("autopilot_runs").select("plan_id, status, error, render_job_id")).data ?? [],
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ["autopilot-jobs"], enabled: !!user, refetchInterval: 15_000,
    queryFn: async () => (await supabase.from("render_jobs").select("id, plan_id, status, progress, output_path, youtube_video_id, error").eq("kind", "autopilot")).data ?? [],
  });
  const STATUS: Record<string, string> = { queued: "Waiting for its turn", claimed: "Starting", generating: "Writing and making scenes", rendering: "Putting the video together", uploading: "Uploading to YouTube", completed: "Ready", failed: "Couldn\u2019t finish", cancelled: "Cancelled", skipped: "Skipped" };
  const cloudStatus = (planId: string) => {
    const job = jobs.find((j) => j.plan_id === planId);
    if (job) return { label: `${STATUS[job.status] ?? job.status}${["rendering", "uploading"].includes(job.status) ? ` ${job.progress}%` : ""}`, job, error: job.status === "failed" ? friendlyAutopilotError(job.error) : null };
    const run = runs.find((r) => r.plan_id === planId);
    if (run) return { label: STATUS[run.status] ?? run.status, job: null, error: ["failed", "skipped", "cancelled"].includes(run.status) ? friendlyAutopilotError(run.error) : null };
    return null;
  };
  const download = async (p: string) => {
    const { data, error } = await supabase.storage.from("video-assets").createSignedUrl(p, 3600, { download: true });
    if (error || !data) { toast.error("Couldn't prepare the download."); return; }
    window.location.href = data.signedUrl;
  };
  const retry = async (id: string) => {
    const { data } = await supabase.rpc("retry_autopilot_plan", { _plan: id });
    if (!data) toast.error("Couldn't retry this one."); else toast.success("It will be retried in a moment.");
    qc.invalidateQueries({ queryKey: ["autopilot-plans"] }); qc.invalidateQueries({ queryKey: ["autopilot-runs"] });
  };

  const { data: plans = [] } = useQuery({
    queryKey: ["autopilot-plans"], enabled: !!user,
    queryFn: async () => (await supabase.from("autopilot_plans").select("*").order("create_on")).data ?? [],
  });
  const { data: uploads = [] } = useQuery({
    queryKey: ["autopilot-uploads"], enabled: !!user,
    queryFn: async () => (await supabase.from("youtube_uploads").select("id, video_id, title, publish_at, youtube_video_id, status").not("publish_at", "is", null).order("publish_at")).data ?? [],
  });
  const madeIds = plans.map((p) => p.video_id).filter(Boolean) as string[];
  const { data: thumbs = {} } = useQuery({
    queryKey: ["autopilot-thumbs", madeIds.join(",")], enabled: madeIds.length > 0,
    queryFn: async () => {
      const [{ data: vids }, { data: scenes }] = await Promise.all([
        supabase.from("videos").select("id, thumbnail_path").in("id", madeIds),
        supabase.from("video_scenes").select("video_id, image_path, position").in("video_id", madeIds).not("image_path", "is", null).order("position"),
      ]);
      const out: Record<string, string> = {};
      for (const id of madeIds) {
        const path = vids?.find((v) => v.id === id)?.thumbnail_path ?? scenes?.find((s) => s.video_id === id)?.image_path;
        if (!path) continue;
        const { data } = await supabase.storage.from("video-assets").createSignedUrl(path, 3600);
        if (data) out[id] = data.signedUrl;
      }
      return out;
    },
  });
  const now = Date.now();
  const upcoming = uploads.filter((u) => u.status === "uploaded" && new Date(u.publish_at!).getTime() > now);
  const released = uploads.filter((u) => u.status === "uploaded" && new Date(u.publish_at!).getTime() <= now);
  const due = plans.filter((p) => !p.cloud && p.status === "planned" && new Date(p.create_on).getTime() <= now);

  const addPlan = async (topic: string, settings: PlanSettings) => {
    if (!user || topic.trim().length < 3) { toast.error("Describe your video idea first."); return false; }
    if (!createOn) { toast.error("Choose when to make it."); return false; }
    if (settings.length && !autopilotLengthOk(Number(settings.length))) { toast.error("Autopilot videos can be up to 20 Minutes long."); return false; }
    const auto = canCloud && cloud;
    if (meta === "manual" && metaTitle.trim().length < 3) { toast.error("Write a title, or choose to make it automatically."); return false; }
    const full = { ...settings, meta, ...(meta === "manual" ? { metaTitle: metaTitle.trim(), metaDescription: metaDescription.trim(), metaTags } : {}) };
    const { error } = await supabase.from("autopilot_plans").insert({ user_id: user.id, topic: topic.trim(), settings: full, cloud: auto, publish_consent: auto && !!publishOn && consent, create_on: new Date(createOn).toISOString(), publish_on: publishOn ? new Date(publishOn).toISOString() : null });
    if (error) { toast.error(error.message); return false; }
    setCreateOn(""); setPublishOn(""); setConsent(false); setMetaTitle(""); setMetaDescription(""); setMetaTags("");
    toast.success("Added to your Autopilot plan.");
    qc.invalidateQueries({ queryKey: ["autopilot-plans"] });
    return true;
  };
  const remove = async (id: string) => {
    await supabase.from("autopilot_plans").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["autopilot-plans"] });
  };
  const markMade = (id: string) => supabase.from("autopilot_plans").update({ status: "made" }).eq("id", id).then(() => qc.invalidateQueries({ queryKey: ["autopilot-plans"] }));

  const stat = "rounded-xl border border-border bg-card p-4";
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container max-w-5xl py-12">
        <h1 className="text-4xl font-extrabold">Autopilot</h1>
        <p className="mt-2 text-muted-foreground">Plan when each video gets made and when it goes live on YouTube.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className={stat}><p className="text-xs text-muted-foreground">Planned videos</p><p className="text-2xl font-bold">{plans.filter((p) => p.status === "planned").length}</p></div>
          <div className={stat}><p className="text-xs text-muted-foreground">Scheduled on YouTube</p><p className="text-2xl font-bold">{upcoming.length}</p></div>
          <div className={stat}><p className="text-xs text-muted-foreground">Next release</p><p className="text-lg font-bold">{upcoming[0] ? fmt(upcoming[0].publish_at!) : "None yet"}</p></div>
        </div>

        {isAdmin && (
          <label className="mt-6 flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm">
            <Switch checked={!!access?.launched} onCheckedChange={setLaunch} aria-label="Automatic making for customers" />
            <span><span className="font-semibold">Admin: automatic making for customers</span><br /><span className="text-xs text-muted-foreground">{access?.launched ? "On — Creator and Pro customers can use it." : "Off — only admins can use it."}</span></span>
          </label>
        )}

        {due.length > 0 && <div role="status" className="mt-6 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">{due.length} planned {due.length === 1 ? "video is" : "videos are"} ready to make today.</div>}

        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-xl font-bold"><Clapperboard className="h-5 w-5 text-primary" />Video plan</h2>
          <div className="mt-4">
            <Create onPlan={addPlan} planExtra={
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-semibold text-muted-foreground">Make it on
                    <DateTimePicker min={localMin()} value={createOn} onChange={setCreateOn} placeholder="Pick a date & time" aria-label="Make it on" />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-muted-foreground">Go live on YouTube (optional)
                    <DateTimePicker min={createOn || localMin()} value={publishOn} onChange={setPublishOn} placeholder="Pick a date & time" aria-label="Go live on YouTube" />
                  </label>
                </div>
                      <div className="grid gap-2 rounded-lg border border-border bg-card p-3 text-sm">
                        <p className="text-xs font-semibold text-muted-foreground">Title, description, tags and thumbnail image</p>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant={meta === "auto" ? "default" : "outline"} onClick={() => setMeta("auto")}>Create them automatically</Button>
                          <Button type="button" size="sm" variant={meta === "manual" ? "default" : "outline"} onClick={() => setMeta("manual")}>I’ll write them myself</Button>
                        </div>
                        {meta === "auto" ? <p className="text-xs text-muted-foreground">Vydora writes the title, description and tags and makes a thumbnail image when the video is made (uses the usual credits for each).</p> : (
                          <div className="grid gap-2">
                            <Input placeholder="Title" maxLength={100} value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} />
                            <Textarea placeholder="Description (optional)" maxLength={5000} value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} />
                            <Input placeholder="Tags, separated by commas (optional)" value={metaTags} onChange={(e) => setMetaTags(e.target.value)} />
                            <p className="text-xs text-muted-foreground">You can add a thumbnail image later from the video editor.</p>
                          </div>
                        )}
                      </div>
                {canCloud ? (
                  cloud && publishOn ? (
                    <div className="grid gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
                      <label className="flex items-start gap-3">
                        <Switch checked={consent} onCheckedChange={setConsent} aria-label="Upload to my YouTube channel" />
                        <span><span className="font-semibold">Upload to my YouTube channel</span><br /><span className="text-xs text-muted-foreground">I allow Vydora to upload this video to my connected channel as private, set to go live at the time above. Leave off to just get the video to download.</span></span>
                      </label>
                    </div>
                  ) : null
                ) : access && !access.subscribed && access.launched ? (
                  <p className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">Want videos made for you automatically? <Link to="/pricing" className="font-semibold text-primary underline">Upgrade to Creator or Pro</Link>.</p>
                ) : null}
                <p className="text-xs text-muted-foreground">{cloud && canCloud
                  ? "Planning is free. Credits are taken at the scheduled creation time, when Vydora makes the video. If you don’t have enough credits then, the video is skipped (nothing is charged) and you can top up and press Retry."
                  : "Planning is free. Credits are only used when you press “Make video” and create it."}</p>
              </div>
            } />
          </div>
          <ul className="mt-4 grid gap-2">
            {plans.length === 0 && <li className="text-sm text-muted-foreground">No planned videos yet.</li>}
            {plans.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm">
                {p.video_id && thumbs[p.video_id] ? (
                  <Link to={`/video/${p.video_id}`} className="shrink-0"><img src={thumbs[p.video_id]} alt={`Thumbnail for ${p.topic}`} className="h-12 w-20 rounded-md border border-border object-cover" loading="lazy" /></Link>
                ) : (
                  <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted/40 text-[10px] text-muted-foreground" aria-label="No video yet">Not made yet</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.topic}</p>
                  <p className="text-xs text-muted-foreground">Make: {fmt(p.create_on)}{p.publish_on && ` · Go live: ${fmt(p.publish_on)}`}</p>
                </div>
                {p.cloud && (() => { const c = cloudStatus(p.id); return (<>
                  <span className="text-xs font-semibold text-primary" >{c?.label ?? (p.status === "skipped" ? "Skipped" : p.status === "failed" ? "Couldn’t finish" : p.status === "queued" ? "Waiting for its turn" : "Automatic")}</span>
                  {(p.note || c?.error) && <span className="w-full text-xs text-destructive">{c?.error ?? friendlyAutopilotError(p.note)}</span>}
                  {p.status === "skipped" && /credit/i.test(p.note ?? "") && <Button asChild size="sm" variant="outline"><Link to="/pricing">Top up</Link></Button>}
                  {c?.job?.youtube_video_id && <Button asChild size="sm" variant="outline"><a href={`https://studio.youtube.com/video/${c.job.youtube_video_id}/edit`} target="_blank" rel="noreferrer">YouTube</a></Button>}
                  {c?.job?.output_path && c.job.status === "completed" && <Button size="sm" variant="outline" onClick={() => download(c.job!.output_path!)}><Download className="mr-1 h-4 w-4" />Download</Button>}
                  {(p.status === "skipped" || p.status === "failed") && <Button size="sm" variant="outline" onClick={() => retry(p.id)}><RotateCcw className="mr-1 h-4 w-4" />Retry</Button>}
                </>); })()}
                {p.cloud ? null : p.status === "made" ? <span className="text-xs font-semibold text-primary">Made</span> : (
                  <Button asChild size="sm" onClick={() => markMade(p.id)}><Link to={`/create?idea=${encodeURIComponent(p.topic)}&settings=${encodeURIComponent(JSON.stringify(p.settings ?? {}))}`}>Make video</Link></Button>
                )}
                <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold">Help and troubleshooting</h2>
          <Accordion type="multiple" className="mt-2">
            {AUTOPILOT_HELP.map((h) => (
              <AccordionItem key={h.q} value={h.q}><AccordionTrigger className="text-left">{h.q}</AccordionTrigger><AccordionContent className="text-muted-foreground">{h.a}</AccordionContent></AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-xl font-bold"><CalendarClock className="h-5 w-5 text-primary" />YouTube release schedule</h2>
          <p className="mt-1 text-sm text-muted-foreground">To schedule a release, open a video, press Publish to YouTube and choose “Schedule for later”.</p>
          <ul className="mt-4 grid gap-2">
            {upcoming.length + released.length === 0 && <li className="text-sm text-muted-foreground">Nothing scheduled yet.</li>}
            {[...upcoming, ...released].map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm">
                <Youtube className="h-4 w-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{u.title || "Untitled video"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(u.publish_at!).getTime() > now ? "Goes live" : "Went live"} {fmt(u.publish_at!)}</p>
                </div>
                <Button asChild size="sm" variant="outline"><Link to={`/video/${u.video_id}`}>Open</Link></Button>
                {u.youtube_video_id && <Button asChild size="sm" variant="outline"><a href={`https://studio.youtube.com/video/${u.youtube_video_id}/edit`} target="_blank" rel="noreferrer">Studio</a></Button>}
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

// Customer-facing wording for Autopilot (hands-off) errors and the help section.
export function friendlyAutopilotError(raw?: string | null): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes("credit")) return "Skipped: you didn’t have enough credits at the scheduled time. Nothing was charged — top up and press Retry.";
  if (s.includes("creator or pro")) return "Skipped: automatic making needs an active Creator or Pro plan.";
  if (s.includes("youtube") && (s.includes("connect") || s.includes("expired"))) return "The video was made, but YouTube needs reconnecting. Reconnect your channel on My profile, then press Retry.";
  if (s.includes("turned off") || s.includes("plan changed")) return "Cancelled because automatic making was turned off for this plan.";
  if (s.includes("removed")) return "Cancelled because the plan was removed.";
  if (s.includes("3 failed attempts")) return "We tried 3 times and couldn’t finish. Any credits for unfinished steps were refunded. Press Retry to try again.";
  if (s.includes("length") || s.includes("scenes")) return "This plan goes over your plan’s video length or scene limit. Remove it and plan a shorter video.";
  return "Something went wrong while making this video. Any credits for unfinished steps were refunded. Press Retry to try again.";
}

export const AUTOPILOT_HELP: { q: string; a: string }[] = [
  { q: "Do I need to keep my browser open?", a: "No. When “Make it automatically” is on, Vydora makes the video on its own servers at the scheduled time. You can close your browser or turn off your computer." },
  { q: "When are credits taken?", a: "Planning is free. Credits are taken at the scheduled creation time, step by step, as the script, pictures, voiceovers and (if chosen) title, description, tags and thumbnail image are made. They cost the same as making the video yourself." },
  { q: "What if I run out of credits?", a: "The video is skipped and nothing more is charged. Top up or wait for your monthly credits, then press Retry — anything already made is kept, so you never pay twice." },
  { q: "Will it post to YouTube without asking?", a: "Never. Vydora only uploads if you turn on “Upload to my YouTube channel” for that plan. Uploads go up as private and go live at the time you chose." },
  { q: "My video says “Couldn’t finish”. What now?", a: "Vydora tries up to 3 times. Credits for any step that failed are refunded automatically. Press Retry to try again, or remove the plan." },
  { q: "YouTube upload failed", a: "Your channel may have been disconnected. Open My profile, reconnect your YouTube channel, then press Retry. The finished video is still available to download." },
  { q: "Who can use automatic making?", a: "Creator and Pro subscribers. Free accounts can still plan videos and make them with one click." },
  { q: "Can I stop a planned video?", a: "Yes — press the bin icon before its scheduled time. Once it has started, removing it stops any further steps." },
];

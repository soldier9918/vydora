import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import fishVideo from "@/assets/samples/antarctic-fish.mp4.asset.json";
import fishPoster from "@/assets/samples/antarctic-fish.jpg.asset.json";
import fishPreview from "@/assets/samples/antarctic-fish-preview.mp4.asset.json";
import salmonVideo from "@/assets/samples/dead-salmon.mp4.asset.json";
import salmonPoster from "@/assets/samples/dead-salmon.jpg.asset.json";
import octopusVideo from "@/assets/samples/octopus.mp4.asset.json";
import octopusPoster from "@/assets/samples/octopus.jpg.asset.json";
import fungusVideo from "@/assets/samples/cicada-fungus.mp4.asset.json";
import fungusPoster from "@/assets/samples/cicada-fungus.jpg.asset.json";

export interface VideoSample {
  title: string;
  video: string;
  poster: string;
  duration: string;
}

export const SAMPLE_VIDEOS: VideoSample[] = [
  { title: "The Antarctic Fish That Makes Its Own Antifreeze", video: fishVideo.url, poster: fishPoster.url, duration: "1 Minute" },
  { title: "The Dead Salmon That Exposed a Brain Science Trap", video: salmonVideo.url, poster: salmonPoster.url, duration: "1 Minute 1 Second" },
  { title: "Are Octopuses the Smartest Animals on Earth?", video: octopusVideo.url, poster: octopusPoster.url, duration: "1 Minute 32 Seconds" },
  { title: "This Fungus Turns Cicadas Into Flying Saltshakers", video: fungusVideo.url, poster: fungusPoster.url, duration: "56 Seconds" },
];

export const HERO_SAMPLE: VideoSample = {
  title: "The Antarctic Fish That Makes Its Own Antifreeze",
  video: fishPreview.url,
  poster: fishPoster.url,
  duration: "30 Seconds preview",
};

export function SampleVideoPlayer({ sample, onClose }: { sample: VideoSample | null; onClose: () => void }) {
  const [failedVideo, setFailedVideo] = useState<string | null>(null);
  return (
    <Dialog open={sample !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      {sample && (
        <DialogContent className="w-[calc(100%-2rem)] max-w-4xl max-h-[90dvh] overflow-y-auto rounded-lg p-4 sm:p-6">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="leading-snug">{sample.title}</DialogTitle>
            <DialogDescription>Made with Vydora · {sample.duration}</DialogDescription>
          </DialogHeader>
          <video
            key={sample.video}
            src={sample.video}
            poster={sample.poster}
            controls
            autoPlay
            playsInline
            preload="metadata"
            aria-label={sample.title}
            className="aspect-video w-full rounded-md bg-background object-contain"
            onError={() => setFailedVideo(sample.video)}
            onLoadedData={() => setFailedVideo(null)}
          />
          {failedVideo === sample.video && (
            <p role="alert" className="text-sm text-muted-foreground">
              This video couldn't load. <a className="text-primary underline" href={sample.video} target="_blank" rel="noopener noreferrer">Open the video</a> or try again.
            </p>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}

export default function SampleVideos({ onSelect }: { onSelect: (sample: VideoSample) => void }) {
  return (
    <section className="container py-20" aria-labelledby="sample-videos-heading">
      <div className="mb-10 text-center">
        <h2 id="sample-videos-heading" className="text-4xl font-extrabold md:text-5xl">Made with Vydora</h2>
        <p className="mt-3 text-muted-foreground">Finished videos created with Vydora.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {SAMPLE_VIDEOS.map((sample) => (
          <Button
            key={sample.video}
            variant="ghost"
            onClick={() => onSelect(sample)}
            aria-label={`Watch ${sample.title}`}
            className="group h-auto min-w-0 flex-col items-stretch gap-0 overflow-hidden whitespace-normal rounded-lg border border-border bg-card p-0 text-left text-foreground hover:bg-card hover:text-foreground"
          >
            <span className="relative block aspect-video overflow-hidden">
              <img src={sample.poster} alt="" loading="lazy" width={960} height={540} className="h-full w-full object-cover transition-transform duration-300 motion-reduce:transition-none group-hover:scale-105" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background/85 text-primary shadow-elevated transition-transform group-hover:scale-110 motion-reduce:transition-none">
                  <Play className="!h-6 !w-6" fill="currentColor" aria-hidden="true" />
                </span>
              </span>
            </span>
            <span className="block p-4">
              <span className="block font-semibold leading-snug">{sample.title}</span>
              <span className="mt-2 block text-sm text-muted-foreground">{sample.duration}</span>
            </span>
          </Button>
        ))}
      </div>
    </section>
  );
}
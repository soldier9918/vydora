import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FileIcon, FolderOpen, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const BUCKET = "video-assets";
const PREVIEW_LIMIT = 8;

type Item = { name: string; path: string; url: string; type: string };

async function loadLibrary(userId: string): Promise<Item[]> {
  const folder = `${userId}/library`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folder, { sortBy: { column: "created_at", order: "desc" }, limit: 500 });
  if (error) throw new Error(error.message);
  const files = (data ?? []).filter((f) => f.id);
  const paths = files.map((f) => `${folder}/${f.name}`);
  const signed = paths.length ? (await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)).data ?? [] : [];
  return files.map((f, i) => ({
    name: f.name.replace(/^\d+-/, ""),
    path: paths[i],
    url: signed[i]?.signedUrl ?? "",
    type: (f.metadata as any)?.mimetype ?? "",
  }));
}

export default function LibrarySection() {
  const { user } = useAuth();
  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["library-files", user?.id],
    enabled: !!user,
    retry: false,
    queryFn: () => loadLibrary(user!.id),
  });

  const count = items?.length ?? 0;
  const preview = (items ?? []).slice(0, PREVIEW_LIMIT);

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
        <FolderOpen className="h-5 w-5 text-primary" />My Library
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your saved images, logos, clips and audio. Only you can see them.
      </p>

      {isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />Loading your library…
        </div>
      ) : isError ? (
        <p className="mt-4 text-sm text-muted-foreground">Couldn’t load your library right now.</p>
      ) : count === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Your library is empty. Upload files and they’ll show up here.
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {preview.map((item) => (
              <div key={item.path} className="overflow-hidden rounded-lg border border-border bg-muted">
                <div className="grid aspect-video place-items-center">
                  {item.type.startsWith("image/") ? (
                    <img src={item.url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : item.type.startsWith("video/") ? (
                    <video src={item.url} className="h-full w-full object-cover" muted preload="metadata" />
                  ) : item.type.startsWith("audio/") ? (
                    <audio src={item.url} controls className="w-full px-1" />
                  ) : (
                    <FileIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <p className="truncate px-2 py-1 text-xs font-medium" title={item.name}>{item.name}</p>
              </div>
            ))}
          </div>
          {count > PREVIEW_LIMIT && (
            <p className="mt-2 text-xs text-muted-foreground">+{count - PREVIEW_LIMIT} more file{(count - PREVIEW_LIMIT) === 1 ? "" : "s"}</p>
          )}
        </>
      )}

      <Link to="/library" className="mt-4 inline-block text-sm text-primary hover:underline">
        Open My Library →
      </Link>
    </section>
  );
}

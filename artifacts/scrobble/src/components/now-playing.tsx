import { useGetNowPlaying, getGetNowPlayingQueryKey } from "@workspace/api-client-react";
import { Loader2, Disc3 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";

export function NowPlaying() {
  const { data: nowPlaying, isLoading } = useGetNowPlaying({
    query: {
      queryKey: getGetNowPlayingQueryKey(),
      refetchInterval: 10000,
    },
  });

  const [progressPercent, setProgressPercent] = useState(0);

  useEffect(() => {
    if (!nowPlaying?.track) {
      setProgressPercent(0);
      return () => {};
    }
    
    const { progressMs, durationMs } = nowPlaying.track;
    const initialPercent = (progressMs / durationMs) * 100;
    setProgressPercent(initialPercent);
    
    if (!nowPlaying.isPlaying) return () => {};

    const interval = setInterval(() => {
      setProgressPercent(p => {
        const addedPercent = (1000 / durationMs) * 100;
        return Math.min(100, p + addedPercent);
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [nowPlaying]);

  if (isLoading) {
    return (
      <div className="h-24 border border-border/50 bg-card rounded-lg flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!nowPlaying?.isPlaying || !nowPlaying.track) {
    return (
      <div className="h-24 border border-border/50 bg-card/30 rounded-lg flex items-center px-6 gap-4 opacity-70">
        <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
          <Disc3 className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Signal Lost</p>
          <p className="text-xs text-muted-foreground mt-1">Silence on the line.</p>
        </div>
      </div>
    );
  }

  const { track } = nowPlaying;

  return (
    <div className="relative overflow-hidden border border-primary/30 bg-card rounded-lg flex items-center p-4 gap-6 group">
      {/* Glitchy background glow */}
      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative h-16 w-16 shrink-0 rounded shadow-[0_0_20px_rgba(0,255,255,0.15)] overflow-hidden">
        {track.albumArt ? (
          <img src={track.albumArt} alt={track.albumName} className="h-full w-full object-cover animate-in fade-in zoom-in duration-700" />
        ) : (
          <div className="h-full w-full bg-muted flex items-center justify-center">
            <Disc3 className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 shadow-inner rounded pointer-events-none border border-white/10" />
      </div>

      <div className="flex-1 min-w-0 z-10">
        <div className="flex items-center gap-2 mb-1">
          <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
          <p className="text-[10px] font-mono text-primary uppercase tracking-widest">Live Feed</p>
        </div>
        <h3 className="font-bold text-lg truncate text-foreground leading-tight">
          {track.trackName}
        </h3>
        <p className="text-sm text-muted-foreground truncate">
          {track.artistName} <span className="mx-1 text-border">•</span> {track.albumName}
        </p>
        
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

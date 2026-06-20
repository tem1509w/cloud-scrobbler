import { useGetScrobbles, getGetScrobblesQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Loader2, Disc3, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const ITEMS_PER_PAGE = 50;

export default function HistoryPage() {
  const [page, setPage] = useState(0);
  
  const { data, isLoading } = useGetScrobbles({
    limit: ITEMS_PER_PAGE,
    offset: page * ITEMS_PER_PAGE
  }, {
    query: { queryKey: getGetScrobblesQueryKey({ limit: ITEMS_PER_PAGE, offset: page * ITEMS_PER_PAGE }) }
  });

  return (
    <AppLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
        <header className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white uppercase" style={{ textShadow: "0 0 40px rgba(255,255,255,0.1)" }}>
            Data Logs
          </h1>
          <p className="text-muted-foreground font-mono text-sm max-w-2xl">
            Historical audio stream records. Sorted by chronological execution.
          </p>
        </header>

        <div className="rounded-xl border border-border bg-card/30 overflow-hidden backdrop-blur-sm">
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          ) : data?.scrobbles.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Disc3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No logs found.</p>
              <p className="text-sm">Connect sources and stream audio to populate data.</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border/50">
                {data?.scrobbles.map((scrobble) => (
                  <div key={scrobble.id} className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors group">
                    <div className="h-12 w-12 shrink-0 rounded shadow-[0_0_10px_rgba(0,0,0,0.5)] overflow-hidden relative border border-white/5">
                      {scrobble.albumArt ? (
                        <img src={scrobble.albumArt} alt={scrobble.albumName} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="h-full w-full bg-muted flex items-center justify-center">
                          <Disc3 className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {scrobble.trackName}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {scrobble.artistName} <span className="opacity-50 mx-1">•</span> {scrobble.albumName}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-mono text-muted-foreground flex items-center gap-1.5 justify-end">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(scrobble.scrobbledAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="p-4 border-t border-border flex items-center justify-between bg-card/80">
                <Button 
                  variant="outline" 
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="font-mono text-xs uppercase tracking-wider"
                >
                  Previous
                </Button>
                <span className="text-xs font-mono text-muted-foreground">
                  Page {page + 1}
                </span>
                <Button 
                  variant="outline" 
                  onClick={() => setPage(p => p + 1)}
                  disabled={!data || data.scrobbles.length < ITEMS_PER_PAGE}
                  className="font-mono text-xs uppercase tracking-wider"
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

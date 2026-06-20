import { 
  useGetScrobblesPerDay, 
  getGetScrobblesPerDayQueryKey,
  useGetTopArtists,
  getGetTopArtistsQueryKey,
  useGetTopTracks,
  getGetTopTracksQueryKey
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Loader2, Disc3, Trophy, BarChart3 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format } from "date-fns";

export default function StatsPage() {
  const { data: dailyData, isLoading: dailyLoading } = useGetScrobblesPerDay({
    query: { queryKey: getGetScrobblesPerDayQueryKey() }
  });

  const { data: topArtists, isLoading: artistsLoading } = useGetTopArtists({ limit: 10 }, {
    query: { queryKey: getGetTopArtistsQueryKey({ limit: 10 }) }
  });

  const { data: topTracks, isLoading: tracksLoading } = useGetTopTracks({ limit: 10 }, {
    query: { queryKey: getGetTopTracksQueryKey({ limit: 10 }) }
  });

  const isLoading = dailyLoading || artistsLoading || tracksLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both pb-10">
        <header className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white uppercase" style={{ textShadow: "0 0 40px rgba(255,255,255,0.1)" }}>
            Telemetry
          </h1>
          <p className="text-muted-foreground font-mono text-sm max-w-2xl">
            Aggregate data analysis over a 30-day trailing window.
          </p>
        </header>

        <section className="space-y-4">
          <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Activity Volume (30D)
          </h3>
          <div className="h-[300px] w-full p-6 border border-border bg-card/30 rounded-xl backdrop-blur-sm">
            {dailyData && dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => format(new Date(val), 'MMM d')}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={30}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${val}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    labelFormatter={(val) => format(new Date(val), 'MMM d, yyyy')}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorCount)" 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">Insufficent data points</div>
            )}
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-8">
          <section className="space-y-4">
            <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Trophy className="h-4 w-4" /> Top Entities [Artists]
            </h3>
            <div className="border border-border bg-card/30 rounded-xl overflow-hidden backdrop-blur-sm">
              <div className="divide-y divide-border/50">
                {topArtists?.map((artist, idx) => (
                  <div key={artist.artistName} className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors group">
                    <div className="w-6 font-mono text-xs text-muted-foreground text-right">{idx + 1}</div>
                    <div className="flex-1 font-bold truncate group-hover:text-primary transition-colors">{artist.artistName}</div>
                    <div className="font-mono text-xs text-muted-foreground bg-background/50 px-2 py-1 rounded border border-border">
                      {artist.count.toLocaleString()} plays
                    </div>
                  </div>
                ))}
                {!topArtists?.length && (
                  <div className="p-8 text-center text-muted-foreground text-sm font-mono">No data</div>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Disc3 className="h-4 w-4" /> Top Entities [Tracks]
            </h3>
            <div className="border border-border bg-card/30 rounded-xl overflow-hidden backdrop-blur-sm">
              <div className="divide-y divide-border/50">
                {topTracks?.map((track, idx) => (
                  <div key={`${track.trackName}-${track.artistName}`} className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors group">
                    <div className="w-6 font-mono text-xs text-muted-foreground text-right">{idx + 1}</div>
                    <div className="h-10 w-10 shrink-0 rounded shadow-[0_0_10px_rgba(0,0,0,0.3)] overflow-hidden">
                      {track.albumArt ? (
                        <img src={track.albumArt} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="h-full w-full bg-muted flex items-center justify-center">
                          <Disc3 className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate group-hover:text-primary transition-colors">{track.trackName}</div>
                      <div className="text-sm text-muted-foreground truncate">{track.artistName}</div>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground bg-background/50 px-2 py-1 rounded border border-border">
                      {track.count.toLocaleString()}
                    </div>
                  </div>
                ))}
                {!topTracks?.length && (
                  <div className="p-8 text-center text-muted-foreground text-sm font-mono">No data</div>
                )}
              </div>
            </div>
          </section>
        </div>

      </div>
    </AppLayout>
  );
}

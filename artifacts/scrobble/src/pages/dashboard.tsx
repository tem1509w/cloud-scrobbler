import {
  useGetMe,
  getGetMeQueryKey,
  useDisconnectSpotify,
  useDisconnectLastfm,
  useGetStatsSummary,
  getGetStatsSummaryQueryKey,
  useTriggerScrobble,
  useSetScrobblingEnabled,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/app-layout";
import { NowPlaying } from "@/components/now-playing";
import { Activity, Music, Share2, LogIn, Loader2, BarChart2, RefreshCw, Radio, RadioTower, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: session, isLoading: sessionLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey() },
  });

  const { data: stats } = useGetStatsSummary({
    query: {
      queryKey: getGetStatsSummaryQueryKey(),
      enabled: !!session?.spotifyConnected && !!session?.lastfmConnected,
    },
  });

  const disconnectSpotify = useDisconnectSpotify({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }),
    },
  });

  const disconnectLastfm = useDisconnectLastfm({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }),
    },
  });

  const triggerScrobble = useTriggerScrobble({
    mutation: {
      onSuccess: (res) => {
        if (res.scrobbled) {
          toast.success("Scrobbled: " + (res.track?.trackName || "Unknown track"));
        } else {
          toast.info(res.message);
        }
        queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
      },
      onError: () => toast.error("Failed to trigger scrobble check"),
    },
  });

  const toggleScrobbling = useSetScrobblingEnabled({
    mutation: {
      onSuccess: (_data, vars) => {
        const enabled = (vars.data as { enabled: boolean }).enabled;
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast.success(enabled ? "Auto-scrobbling enabled" : "Auto-scrobbling paused");
      },
      onError: () => toast.error("Failed to update scrobbling setting"),
    },
  });

  if (sessionLoading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  const isFullyConnected = session.spotifyConnected && session.lastfmConnected;
  const autoScrobbling = session.scrobblingEnabled && isFullyConnected;

  return (
    <AppLayout>
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
        {/* Header */}
        <header className="space-y-2">
          <h1
            className="text-4xl md:text-5xl font-bold tracking-tight text-white uppercase"
            style={{ textShadow: "0 0 40px rgba(255,255,255,0.1)" }}
          >
            Control Room
          </h1>
          <p className="text-muted-foreground font-mono text-sm max-w-2xl">
            Signal processing active. Manage connections and monitor the live data stream.
          </p>
        </header>

        {/* Spotify reconnect warning */}
        {session.spotifyNeedsReconnect && (
          <div className="flex items-center gap-4 px-5 py-4 rounded-xl border border-yellow-500/40 bg-yellow-500/10 text-yellow-300">
            <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-400" />
            <div className="flex-1 text-sm font-mono">
              Spotify token expired — auto-scrobbling is paused.
            </div>
            <Button
              size="sm"
              className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 font-bold uppercase tracking-wider text-xs"
              onClick={() => window.open("/api/auth/spotify/connect", "oauth", "width=520,height=700,left=200,top=100")}
            >
              Reconnect Spotify
            </Button>
          </div>
        )}

        {/* Connect Flow or Dashboard */}
        {!isFullyConnected ? (
          <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
            {/* Spotify Card */}
            <div
              className={`relative p-8 rounded-xl border ${
                session.spotifyConnected
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-card/50"
              } backdrop-blur-sm overflow-hidden`}
            >
              <div className="flex flex-col h-full relative z-10">
                <div className="mb-6 flex items-center justify-between">
                  <div className="h-12 w-12 rounded-lg bg-[#1DB954]/20 flex items-center justify-center">
                    <Music className="h-6 w-6 text-[#1DB954]" />
                  </div>
                  {session.spotifyConnected && (
                    <div className="px-3 py-1 bg-primary/20 text-primary text-[10px] uppercase font-mono rounded tracking-wider border border-primary/30">
                      Active
                    </div>
                  )}
                </div>
                <h2 className="text-2xl font-bold mb-2">Spotify Output</h2>
                <p className="text-muted-foreground text-sm flex-1 mb-8">
                  Connect your Spotify account to enable the audio stream source.
                </p>
                {session.spotifyConnected ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border">
                      {session.spotifyUser?.imageUrl ? (
                        <img
                          src={session.spotifyUser.imageUrl}
                          className="h-8 w-8 rounded-full"
                          alt="avatar"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <Activity className="h-4 w-4" />
                        </div>
                      )}
                      <span className="font-medium text-sm">{session.spotifyUser?.displayName}</span>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => disconnectSpotify.mutate()}
                      disabled={disconnectSpotify.isPending}
                    >
                      Disconnect Source
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold uppercase tracking-wider"
                    onClick={() => window.open("/api/auth/spotify/connect", "oauth", "width=520,height=700,left=200,top=100")}
                  >
                    <LogIn className="mr-2 h-4 w-4" /> Connect Source
                  </Button>
                )}
              </div>
            </div>

            {/* Last.fm Card */}
            <div
              className={`relative p-8 rounded-xl border ${
                session.lastfmConnected
                  ? "border-[#d51007]/30 bg-[#d51007]/5"
                  : "border-border bg-card/50"
              } backdrop-blur-sm overflow-hidden`}
            >
              <div className="flex flex-col h-full relative z-10">
                <div className="mb-6 flex items-center justify-between">
                  <div className="h-12 w-12 rounded-lg bg-[#d51007]/20 flex items-center justify-center">
                    <Share2 className="h-6 w-6 text-[#d51007]" />
                  </div>
                  {session.lastfmConnected && (
                    <div className="px-3 py-1 bg-[#d51007]/20 text-[#d51007] text-[10px] uppercase font-mono rounded tracking-wider border border-[#d51007]/30">
                      Active
                    </div>
                  )}
                </div>
                <h2 className="text-2xl font-bold mb-2">Last.fm Target</h2>
                <p className="text-muted-foreground text-sm flex-1 mb-8">
                  Connect Last.fm to receive the data stream and log your history.
                </p>
                {session.lastfmConnected ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <Activity className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-sm">{session.lastfmUser?.username}</span>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => disconnectLastfm.mutate()}
                      disabled={disconnectLastfm.isPending}
                    >
                      Disconnect Target
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full bg-[#d51007] hover:bg-[#ff160a] text-white font-bold uppercase tracking-wider"
                    onClick={() => window.open("/api/auth/lastfm/connect", "oauth", "width=520,height=700,left=200,top=100")}
                  >
                    <LogIn className="mr-2 h-4 w-4" /> Connect Target
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-8">
            {/* Auto-scrobble status bar */}
            <div
              className={cn(
                "flex items-center justify-between px-5 py-3 rounded-xl border font-mono text-sm",
                autoScrobbling
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-card/30"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <RadioTower
                    className={cn(
                      "h-4 w-4",
                      autoScrobbling ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  {autoScrobbling && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_6px_rgba(0,255,255,0.8)]" />
                  )}
                </div>
                <span className={autoScrobbling ? "text-primary" : "text-muted-foreground"}>
                  {autoScrobbling
                    ? "AUTO-SCROBBLE ACTIVE — monitoring every 30s"
                    : "AUTO-SCROBBLE PAUSED"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] uppercase tracking-widest"
                  onClick={() => triggerScrobble.mutate()}
                  disabled={triggerScrobble.isPending}
                >
                  <RefreshCw
                    className={cn("h-3 w-3 mr-1.5", triggerScrobble.isPending && "animate-spin")}
                  />
                  Force Sync
                </Button>
                <Button
                  variant={autoScrobbling ? "outline" : "default"}
                  size="sm"
                  className={cn(
                    "h-7 text-[10px] uppercase tracking-widest",
                    autoScrobbling
                      ? "border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                      : "bg-primary text-primary-foreground"
                  )}
                  onClick={() =>
                    toggleScrobbling.mutate({ data: { enabled: !session.scrobblingEnabled } })
                  }
                  disabled={toggleScrobbling.isPending}
                >
                  <Radio className="h-3 w-3 mr-1.5" />
                  {autoScrobbling ? "Pause" : "Resume"}
                </Button>
              </div>
            </div>

            {/* Live Monitor */}
            <div className="max-w-2xl">
              <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-4">
                <Activity className="h-4 w-4" /> Live Monitor
              </h3>
              <NowPlaying />
            </div>

            {/* Telemetry */}
            {stats && (
              <div>
                <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                  <BarChart2 className="h-4 w-4" /> System Telemetry
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Total Scrobbles", value: stats.totalScrobbles },
                    { label: "Today", value: stats.todayCount ?? 0 },
                    { label: "Unique Tracks", value: stats.uniqueTracks },
                    { label: "Unique Artists", value: stats.uniqueArtists },
                  ].map((stat, i) => (
                    <div
                      key={i}
                      className="p-6 border border-border bg-card/30 rounded-xl relative overflow-hidden group"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
                        {stat.label}
                      </p>
                      <p className="text-3xl font-bold text-foreground">
                        {stat.value.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connected accounts (compact) */}
            <div>
              <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-4">
                Connections
              </h3>
              <div className="flex gap-4 flex-wrap">
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-[#1DB954]/20 bg-[#1DB954]/5">
                  <Music className="h-4 w-4 text-[#1DB954]" />
                  <span className="text-sm font-medium">{session.spotifyUser?.displayName}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive ml-1"
                    onClick={() => disconnectSpotify.mutate()}
                    disabled={disconnectSpotify.isPending}
                  >
                    Disconnect
                  </Button>
                </div>
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-[#d51007]/20 bg-[#d51007]/5">
                  <Share2 className="h-4 w-4 text-[#d51007]" />
                  <span className="text-sm font-medium">{session.lastfmUser?.username}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive ml-1"
                    onClick={() => disconnectLastfm.mutate()}
                    disabled={disconnectLastfm.isPending}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

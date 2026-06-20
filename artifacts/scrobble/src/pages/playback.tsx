import { useState } from "react";
import {
  useGetPlaylists,
  getGetPlaylistsQueryKey,
  useGetDevices,
  getGetDevicesQueryKey,
  useStartPlayback,
  usePausePlayback,
  useSetRepeatMode,
  useGetNowPlaying,
  getGetNowPlayingQueryKey,
  useGetMe,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  Repeat,
  Monitor,
  Smartphone,
  Speaker,
  Loader2,
  Music2,
  Disc3,
  RefreshCw,
  LogIn,
  ChevronDown,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function DeviceIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (t === "smartphone") return <Smartphone className="h-4 w-4" />;
  if (t === "speaker") return <Speaker className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

export default function Playback() {
  const queryClient = useQueryClient();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [activePlaylistUri, setActivePlaylistUri] = useState<string | null>(null);
  const [showDevices, setShowDevices] = useState(false);

  const { data: session } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });

  const {
    data: playlists,
    isLoading: playlistsLoading,
    error: playlistsError,
  } = useGetPlaylists({
    query: {
      queryKey: getGetPlaylistsQueryKey(),
      enabled: !!session?.spotifyConnected,
      retry: false,
    },
  });

  const { data: devices, isLoading: devicesLoading, refetch: refetchDevices } = useGetDevices({
    query: {
      queryKey: getGetDevicesQueryKey(),
      enabled: !!session?.spotifyConnected,
      refetchInterval: 15000,
    },
  });

  const { data: nowPlaying } = useGetNowPlaying({
    query: {
      queryKey: getGetNowPlayingQueryKey(),
      refetchInterval: 5000,
    },
  });

  const startPlayback = useStartPlayback({
    mutation: {
      onSuccess: (_, vars) => {
        const uri = (vars.data as { contextUri: string }).contextUri;
        setActivePlaylistUri(uri);
        queryClient.invalidateQueries({ queryKey: getGetNowPlayingQueryKey() });
        toast.success("Playback started — auto-scrobbling is active");
      },
      onError: () => toast.error("Playback failed. Make sure Spotify is open on a device."),
    },
  });

  const pausePlayback = usePausePlayback({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetNowPlayingQueryKey() });
        toast.success("Paused");
      },
    },
  });

  const setRepeat = useSetRepeatMode({
    mutation: {
      onSuccess: (_data, vars) => {
        const enabled = (vars.data as { state: string }).state === "context";
        setRepeatEnabled(enabled);
        toast.success(enabled ? "Repeat on" : "Repeat off");
      },
    },
  });

  const needsReconnect =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    playlistsError && (playlistsError as any)?.status === 403;

  const activeDevice =
    devices?.find((d) => d.id === selectedDeviceId) ??
    devices?.find((d) => d.isActive) ??
    null;

  const handlePlay = (contextUri: string) => {
    startPlayback.mutate({
      data: {
        contextUri,
        deviceId: activeDevice?.id ?? null,
        repeat: repeatEnabled,
      },
    });
  };

  const handleRepeatToggle = () => {
    const newState = repeatEnabled ? "off" : "context";
    setRepeat.mutate({ data: { state: newState } });
  };

  if (!session?.spotifyConnected) {
    return (
      <AppLayout>
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <header>
            <h1 className="text-4xl font-bold tracking-tight text-white uppercase">Playback</h1>
            <p className="text-muted-foreground font-mono text-sm mt-2">
              Play any playlist or album directly from here.
            </p>
          </header>
          <div className="max-w-sm p-8 border border-border bg-card/30 rounded-xl flex flex-col items-center gap-4 text-center">
            <div className="h-14 w-14 rounded-full bg-[#1DB954]/10 flex items-center justify-center">
              <Music2 className="h-7 w-7 text-[#1DB954]" />
            </div>
            <p className="text-muted-foreground text-sm">Connect Spotify to browse and play your playlists.</p>
            <Button
              className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold uppercase tracking-wider w-full"
              onClick={() => (window.location.href = "/api/auth/spotify/connect")}
            >
              <LogIn className="mr-2 h-4 w-4" /> Connect Spotify
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white uppercase">Playback</h1>
            <p className="text-muted-foreground font-mono text-sm mt-1">
              Select a playlist or album — it plays on Spotify and auto-scrobbles.
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Repeat toggle */}
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 text-[10px] font-mono uppercase tracking-widest gap-1.5",
                repeatEnabled
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "text-muted-foreground"
              )}
              onClick={handleRepeatToggle}
              disabled={setRepeat.isPending}
            >
              <Repeat className="h-3 w-3" />
              {repeatEnabled ? "Repeat On" : "Repeat Off"}
            </Button>

            {/* Pause button */}
            {nowPlaying?.isPlaying && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[10px] font-mono uppercase tracking-widest gap-1.5"
                onClick={() => pausePlayback.mutate()}
                disabled={pausePlayback.isPending}
              >
                <Pause className="h-3 w-3" />
                Pause
              </Button>
            )}
          </div>
        </header>

        {/* Now Playing mini-bar */}
        {nowPlaying?.isPlaying && nowPlaying.track && (
          <div className="flex items-center gap-4 px-4 py-3 rounded-xl border border-primary/30 bg-primary/5 font-mono">
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_6px_rgba(0,255,255,0.8)]" />
            <div className="flex items-center gap-3 min-w-0">
              {nowPlaying.track.albumArt && (
                <img
                  src={nowPlaying.track.albumArt}
                  className="h-8 w-8 rounded object-cover shrink-0"
                  alt=""
                />
              )}
              <span className="text-xs text-primary truncate">
                {nowPlaying.track.trackName}
                <span className="text-primary/60 mx-2">—</span>
                {nowPlaying.track.artistName}
              </span>
            </div>
            <span className="text-[10px] text-primary/60 ml-auto shrink-0">PLAYING</span>
          </div>
        )}

        {/* Device selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Output Device
            </h2>
            <button
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              onClick={() => {
                refetchDevices();
                setShowDevices((v) => !v);
              }}
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>

          {devicesLoading ? (
            <div className="h-10 flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Scanning devices...
            </div>
          ) : !devices || devices.length === 0 ? (
            <div className="px-4 py-3 rounded-lg border border-dashed border-border text-sm text-muted-foreground font-mono">
              No active devices found. Open Spotify on any device first.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {devices.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDeviceId(d.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-mono transition-all",
                    (selectedDeviceId === d.id) || (!selectedDeviceId && d.isActive)
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border bg-card/30 text-muted-foreground hover:border-border/80 hover:text-foreground"
                  )}
                >
                  <DeviceIcon type={d.type} />
                  <span className="text-xs">{d.name}</span>
                  {d.isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#1DB954]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reconnect banner */}
        {needsReconnect && (
          <div className="p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-400">Spotify reconnect needed</p>
              <p className="text-xs text-muted-foreground mt-1">
                Playlist and playback permissions require reconnecting your Spotify account.
              </p>
            </div>
            <Button
              size="sm"
              className="shrink-0 bg-[#1DB954] hover:bg-[#1ed760] text-black text-xs font-bold uppercase"
              onClick={() => (window.location.href = "/api/auth/spotify/connect")}
            >
              Reconnect
            </Button>
          </div>
        )}

        {/* Playlists grid */}
        <div>
          <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">
            Your Playlists
          </h2>

          {playlistsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl bg-card/30 border border-border animate-pulse"
                />
              ))}
            </div>
          ) : !playlists || playlists.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground font-mono text-sm">
              No playlists found on this account.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {playlists.map((pl) => {
                const isPlaying =
                  activePlaylistUri === pl.uri && nowPlaying?.isPlaying;
                const isLoading =
                  startPlayback.isPending &&
                  (startPlayback.variables?.data as { contextUri?: string } | undefined)
                    ?.contextUri === pl.uri;

                return (
                  <button
                    key={pl.id}
                    onClick={() => handlePlay(pl.uri)}
                    disabled={startPlayback.isPending}
                    className={cn(
                      "group relative flex flex-col rounded-xl border overflow-hidden text-left transition-all duration-200",
                      isPlaying
                        ? "border-primary/50 shadow-[0_0_20px_rgba(0,255,255,0.15)]"
                        : "border-border bg-card/30 hover:border-border/80 hover:bg-card/60"
                    )}
                  >
                    {/* Art */}
                    <div className="relative aspect-square w-full bg-muted overflow-hidden">
                      {pl.imageUrl ? (
                        <img
                          src={pl.imageUrl}
                          alt={pl.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Disc3 className="h-10 w-10 text-muted-foreground/40" />
                        </div>
                      )}

                      {/* Overlay on hover / playing */}
                      <div
                        className={cn(
                          "absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity duration-200",
                          isPlaying || isLoading
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100"
                        )}
                      >
                        {isLoading ? (
                          <Loader2 className="h-8 w-8 text-white animate-spin" />
                        ) : isPlaying ? (
                          <div className="flex items-end gap-0.5 h-6">
                            {[1, 2, 3, 4].map((i) => (
                              <div
                                key={i}
                                className="w-1 bg-primary rounded-sm animate-pulse"
                                style={{
                                  height: `${25 + i * 15}%`,
                                  animationDelay: `${i * 0.15}s`,
                                  animationDuration: "0.8s",
                                }}
                              />
                            ))}
                          </div>
                        ) : (
                          <Play className="h-8 w-8 text-white fill-white" />
                        )}
                      </div>

                      {isPlaying && (
                        <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_6px_rgba(0,255,255,0.8)]" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-2.5">
                      <p className="text-xs font-medium text-foreground truncate leading-snug">
                        {pl.name}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                        {pl.trackCount} tracks
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

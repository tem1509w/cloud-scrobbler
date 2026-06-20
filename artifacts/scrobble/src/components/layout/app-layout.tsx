import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Headphones, Activity, ListMusic, Loader2, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function NavItem({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ElementType;
  children: ReactNode;
}) {
  const [location] = useLocation();
  const isActive = location === href;

  return (
    <Link href={href} className="block w-full">
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-md transition-all font-medium",
          isActive
            ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(0,255,255,0.3)]"
            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
        {children}
      </div>
    </Link>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { data: session, isLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey() },
  });

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background dark text-foreground">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-card/50 flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-border">
          <div className="h-10 w-10 bg-primary rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(0,255,255,0.4)]">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white uppercase">
            SCROBBLE
          </span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <NavItem href="/" icon={Headphones}>
            Control Room
          </NavItem>
          <NavItem href="/playback" icon={PlayCircle}>
            Playback
          </NavItem>
          <NavItem href="/history" icon={ListMusic}>
            Scrobbles
          </NavItem>
          <NavItem href="/stats" icon={Activity}>
            Analytics
          </NavItem>
        </nav>

        <div className="p-4 border-t border-border mt-auto">
          {isLoading ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Connecting...</span>
            </div>
          ) : session ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-muted-foreground">Status</span>
                <div className="flex gap-1">
                  <div className={cn("h-2 w-2 rounded-full", session.spotifyConnected ? "bg-primary shadow-[0_0_8px_rgba(0,255,255,0.6)]" : "bg-muted")} title="Spotify" />
                  <div className={cn("h-2 w-2 rounded-full", session.lastfmConnected ? "bg-[#d51007] shadow-[0_0_8px_rgba(213,16,7,0.6)]" : "bg-muted")} title="Last.fm" />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 max-h-[100dvh] overflow-auto relative bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-card/30 via-background to-background">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.opacity-20.app/noise.svg')] opacity-[0.03] pointer-events-none mix-blend-overlay"></div>
        <div className="relative z-10 flex-1 p-6 md:p-10 w-full max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

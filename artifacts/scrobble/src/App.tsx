import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import HistoryPage from "@/pages/history";
import StatsPage from "@/pages/stats";
import PlaybackPage from "@/pages/playback";

const queryClient = new QueryClient();

// Runs inside the OAuth popup to signal the opener and close itself
function OAuthPopupHandler() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthComplete = params.get("oauth_complete");
    const oauthError = params.get("error");

    if ((oauthComplete || oauthError) && window.opener) {
      try {
        window.opener.postMessage(
          { type: "oauth_complete", result: oauthComplete ?? "error", error: oauthError },
          window.location.origin
        );
      } catch {}
      window.close();
    }
  }, []);

  return null;
}

// Runs in the main window to listen for popup completion and refresh auth state
function OAuthMessageListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "oauth_complete") {
        queryClient.invalidateQueries();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [queryClient]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/stats" component={StatsPage} />
      <Route path="/playback" component={PlaybackPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <OAuthPopupHandler />
          <OAuthMessageListener />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

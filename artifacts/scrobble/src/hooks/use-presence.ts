import { useEffect } from "react";

export function usePresence(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    const ping = (): void => {
      fetch("/api/presence/ping", { method: "POST" }).catch(() => {});
    };

    ping();
    const interval = setInterval(ping, 30_000);
    return () => clearInterval(interval);
  }, [active]);
}

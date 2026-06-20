const presenceMap = new Map<number, number>(); // userId → lastPingAt (ms)
const reconnectSet = new Set<number>(); // userIds whose Spotify token is dead

const PRESENCE_TIMEOUT_MS = 60_000;

export function updatePresence(userId: number): void {
  presenceMap.set(userId, Date.now());
}

export function isUserPresent(userId: number): boolean {
  const lastPing = presenceMap.get(userId);
  if (!lastPing) return false;
  return Date.now() - lastPing < PRESENCE_TIMEOUT_MS;
}

export function markNeedsReconnect(userId: number): void {
  reconnectSet.add(userId);
}

export function clearNeedsReconnect(userId: number): void {
  reconnectSet.delete(userId);
}

export function checkNeedsReconnect(userId: number): boolean {
  return reconnectSet.has(userId);
}

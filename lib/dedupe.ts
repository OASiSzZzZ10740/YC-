// Best-effort per-instance protection. A shared persistent store is required
// before claiming cross-instance exactly-once processing on Vercel.
const seen = new Map<string, number>();
export function claimEvent(id: string, now = Date.now()): boolean {
  for (const [key, expiry] of seen) if (expiry <= now) seen.delete(key);
  if (seen.has(id)) return false;
  if (seen.size >= 10000) throw new Error('dedupe_capacity');
  seen.set(id, now + 24 * 60 * 60 * 1000);
  return true;
}

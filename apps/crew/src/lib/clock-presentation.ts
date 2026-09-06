import type { ActiveEntry } from "../types/clock";
export function elapsedTime(entry: ActiveEntry, now: Date) {
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(entry.clock_in_at)) / 60000));
  return Number.isFinite(minutes) ? `${Math.floor(minutes / 60)}h ${minutes % 60}m elapsed` : "Elapsed time unavailable";
}

import type { PunchLocation } from "../types/clock";

export type LocationIssue = "denied" | "restricted" | "unavailable" | "timeout" | "failed";
export class PunchLocationError extends Error {
  constructor(public readonly kind: LocationIssue) {
    super({
      denied: "Location permission wasn’t granted. You can try again.",
      restricted: "Location access is off for YardClock. Enable it in your device settings.",
      unavailable: "Location services are unavailable. Check your device’s location settings.",
      timeout: "Finding your location took too long. Try again somewhere with a clearer signal.",
      failed: "We couldn’t get a usable location. Please try again.",
    }[kind]);
  }
}
interface Permission { granted: boolean; canAskAgain: boolean }
export interface LocationAdapter {
  getPermission(): Promise<Permission>;
  requestPermission(): Promise<Permission>;
  servicesEnabled(): Promise<boolean>;
  currentPosition(): Promise<{ coords: { latitude: number; longitude: number; accuracy: number | null }; timestamp: number }>;
}
export async function capturePunchLocation(adapter: LocationAdapter, timeoutMs = 15_000): Promise<PunchLocation> {
  let permission = await adapter.getPermission();
  if (!permission.granted && permission.canAskAgain) permission = await adapter.requestPermission();
  if (!permission.granted) throw new PunchLocationError(permission.canAskAgain ? "denied" : "restricted");
  if (!await adapter.servicesEnabled()) throw new PunchLocationError("unavailable");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const reading = await Promise.race([
      adapter.currentPosition(),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new PunchLocationError("timeout")), timeoutMs); }),
    ]);
    const { latitude, longitude, accuracy } = reading.coords;
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude)
      || longitude < -180 || longitude > 180 || accuracy === null || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100000
      || !Number.isFinite(reading.timestamp) || Math.abs(Date.now() - reading.timestamp) > 120_000) throw new PunchLocationError("failed");
    return { latitude, longitude, accuracyM: accuracy, capturedAt: new Date(reading.timestamp).toISOString() };
  } catch (error) {
    throw error instanceof PunchLocationError ? error : new PunchLocationError("failed");
  } finally { clearTimeout(timer); }
}

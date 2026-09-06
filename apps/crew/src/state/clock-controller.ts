import { ClockError } from "../services/crew-clock";
import { PunchLocationError } from "../lib/punch-location";
import type { ClockContext, ClockResult, PendingPunch, PunchLocation } from "../types/clock";

interface Dependencies {
  load(): Promise<ClockContext>;
  submit(pending: PendingPunch, gps: PunchLocation | null): Promise<ClockResult>;
  resolve(pending: PendingPunch): Promise<ClockResult | null>;
  locate(): Promise<PunchLocation>;
  newId(): string;
  storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };
}
export interface ClockState {
  phase: "loading" | "ready" | "locating" | "submitting" | "error";
  context: ClockContext | null;
  pending: PendingPunch | null;
  locationIssue: PunchLocationError | null;
  error: ClockError | null;
  notice: string | null;
}
const initial: ClockState = { phase: "loading", context: null, pending: null, locationIssue: null, error: null, notice: null };

function resultNotice(result: ClockResult) {
  if (result.status === "outside_radius") return "Your location did not pass your workplace’s existing job-site check. Contact your manager or try again at the assigned site.";
  if (result.status === "low_accuracy") return "Your location wasn’t accurate enough for your workplace’s existing check. Try again with a clearer signal.";
  return result.timeEntryId ? "Punch confirmed. Your current status is shown below." : "This punch did not start a time entry. Please contact your manager.";
}
async function bounded<T>(operation: Promise<T>, error: ClockError, ms = 20000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(error), ms);
    })]);
  } finally { clearTimeout(timer); }
}
function storedPunch(raw: string | null): PendingPunch | null {
  if (!raw) return null;
  const value = JSON.parse(raw) as PendingPunch;
  if (!value || !["in", "out"].includes(value.kind) || typeof value.requestId !== "string"
    || !/^[\da-f-]{36}$/i.test(value.requestId)
    || !["expectedEntryId", "locationId", "shiftId", "jobId"].every((key) => {
      const item = value[key as keyof PendingPunch];
      return item === null || typeof item === "string";
    })) throw new ClockError("read");
  return value;
}

// One controller per account/organization is shared by both tabs and survives
// auth-provider remounts. The synchronous lock covers permission dialogs too.
export class ClockController {
  private state: ClockState = initial;
  private busy = false;
  private draft: PendingPunch | null = null;
  private listeners = new Set<() => void>();
  constructor(private readonly deps: Dependencies, private readonly storageKey: string) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(value: Partial<ClockState>) {
    this.state = { ...this.state, ...value };
    this.listeners.forEach((listener) => listener());
  }
  private async clearPending() {
    await this.deps.storage.removeItem(this.storageKey);
    this.update({ pending: null });
  }
  private async reload() {
    const context = await bounded(this.deps.load(), new ClockError("read"));
    this.update({ context });
  }
  refresh = async () => {
    if (this.busy) return;
    this.busy = true;
    this.update({ phase: "loading", error: null, locationIssue: null });
    try {
      const pending = storedPunch(await this.deps.storage.getItem(this.storageKey));
      this.update({ pending });
      if (pending) {
        const result = await bounded(this.deps.resolve(pending), new ClockError("read"));
        if (result) { await this.clearPending(); this.update({ notice: resultNotice(result) }); }
      }
      await this.reload();
      this.update({ phase: "ready" });
    } catch (error) {
      this.update({ phase: "error", context: null, error: error instanceof ClockError ? error : new ClockError("read") });
    } finally { this.busy = false; }
  };
  begin = async (selection: { locationId: string | null; shiftId: string | null; jobId: string | null }) => {
    if (this.busy || this.state.phase !== "ready" || !this.state.context?.canUse || this.state.pending) return;
    const active = this.state.context.activeEntry;
    if (active && this.state.context.hasOpenBreak) { this.update({ error: new ClockError("break") }); return; }
    if (!active && !selection.locationId) { this.update({ error: new ClockError("invalid") }); return; }
    this.draft = {
      requestId: this.deps.newId(), kind: active ? "out" : "in",
      expectedEntryId: active?.id ?? this.state.context.latestEntryId,
      locationId: active?.location_id ?? selection.locationId,
      shiftId: active?.shift_id ?? selection.shiftId, jobId: active ? null : selection.jobId,
    };
    await this.perform(this.draft, false);
  };
  retry = async (withoutLocation = false) => {
    const pending = this.state.pending ?? this.draft;
    if (!pending || this.busy || this.state.phase !== "ready") return;
    await this.perform(pending, withoutLocation);
  };
  private async perform(pending: PendingPunch, withoutLocation: boolean) {
    if (this.busy) return;
    if (withoutLocation && pending.kind === "in" && this.state.context?.fieldRequired) return;
    this.busy = true;
    this.update({ phase: "locating", error: null, locationIssue: null, notice: null });
    let submitted = false;
    try {
      const gps = withoutLocation ? null : await this.deps.locate();
      // Only IDs/context persist. Coordinates remain transient until the RPC.
      await this.deps.storage.setItem(this.storageKey, JSON.stringify(pending));
      this.update({ phase: "submitting", pending });
      submitted = true;
      const result = await bounded(this.deps.submit(pending, gps), new ClockError("uncertain"));
      await this.clearPending();
      this.draft = null;
      this.update({ notice: resultNotice(result) });
      await this.reload();
      this.update({ phase: "ready" });
    } catch (error) {
      if (error instanceof PunchLocationError) {
        this.update({ phase: "ready", locationIssue: error });
      } else {
        const failure = error instanceof ClockError ? error : new ClockError(submitted ? "uncertain" : "read");
        // A definite database rejection has no committed punch. Ambiguous
        // transport failures retain the same ID and require reconciliation.
        if (submitted && !["uncertain", "read", "session"].includes(failure.kind)) {
          try { await this.clearPending(); } catch { /* Preserve pending if storage failed. */ }
        }
        this.update({ phase: "error", context: null, error: failure });
      }
    } finally { this.busy = false; }
  }
}

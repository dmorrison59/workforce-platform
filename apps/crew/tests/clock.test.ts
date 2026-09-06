import { afterEach, describe, expect, it, vi } from "vitest";
import { ClockController } from "../src/state/clock-controller";
import { ClockError, clockFailure } from "../src/services/crew-clock";
import { capturePunchLocation, PunchLocationError, type LocationAdapter } from "../src/lib/punch-location";
import { elapsedTime } from "../src/lib/clock-presentation";
import type { ActiveEntry, ClockContext, PendingPunch } from "../src/types/clock";

const active: ActiveEntry = { id: "entry", clock_in_at: "2026-09-03T11:03:00Z", location_id: "location", shift_id: null, location_name: "Site" };
const empty: ClockContext = { employeeId: "employee", activeEntry: null, latestEntryId: null, hasOpenBreak: false, canUse: true,
  canUseField: true, fieldRequired: false, jobs: [], locations: [{ id: "location", name: "Site" }] };
const selection = { locationId: "location", shiftId: null, jobId: null };
const gps = { latitude: 40, longitude: -74, accuracyM: 10, capturedAt: "2026-09-03T11:03:00Z" };
const id = "11111111-1111-4111-8111-111111111111";
function fixture() {
  const stored = new Map<string, string>();
  const deps = {
    load: vi.fn(async (): Promise<ClockContext> => ({ ...empty })),
    submit: vi.fn<(pending: PendingPunch, sample: typeof gps | null) => Promise<{ timeEntryId: string; status: string }>>()
      .mockResolvedValue({ timeEntryId: "entry", status: "clocked_in" }),
    resolve: vi.fn(async (): Promise<{ timeEntryId: string; status: string } | null> => null),
    locate: vi.fn(async () => gps), newId: vi.fn(() => id),
    storage: { getItem: vi.fn(async (key: string) => stored.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => { stored.set(key, value); }),
      removeItem: vi.fn(async (key: string) => { stored.delete(key); }) },
  };
  return { controller: new ClockController(deps, "pending"), deps, stored };
}
afterEach(() => vi.useRealTimers());
describe("clock state and punch lifecycle", () => {
  it("loads not-clocked-in state from the backend", async () => {
    const { controller } = fixture();
    expect(controller.getSnapshot().phase).toBe("loading");
    await controller.refresh();
    expect(controller.getSnapshot()).toMatchObject({ phase: "ready", context: { activeEntry: null } });
  });
  it("restores active entry on a new controller/reload", async () => {
    const { controller, deps } = fixture();
    deps.load.mockResolvedValue({ ...empty, activeEntry: active, latestEntryId: active.id });
    await controller.refresh();
    expect(controller.getSnapshot().context?.activeEntry).toEqual(active);
  });
  it("shows locating then submitting and blocks duplicate taps throughout", async () => {
    const { controller, deps } = fixture();
    let finishGps!: (value: typeof gps) => void;
    let finishMutation!: (value: { timeEntryId: string; status: string }) => void;
    deps.locate.mockImplementation(() => new Promise((resolve) => { finishGps = resolve; }));
    deps.submit.mockImplementation(() => new Promise((resolve) => { finishMutation = resolve; }));
    await controller.refresh();
    const first = controller.begin(selection);
    expect(controller.getSnapshot().phase).toBe("locating");
    await controller.begin(selection);
    expect(deps.locate).toHaveBeenCalledTimes(1);
    finishGps(gps);
    await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe("submitting"));
    await controller.begin(selection);
    expect(deps.submit).toHaveBeenCalledTimes(1);
    finishMutation({ timeEntryId: "entry", status: "clocked_in" });
    await first;
    expect(controller.getSnapshot().phase).toBe("ready");
  });
  it("keeps request ID but not GPS on an ambiguous network response", async () => {
    const { controller, deps, stored } = fixture();
    deps.submit.mockRejectedValue(new ClockError("uncertain"));
    await controller.refresh();
    await controller.begin(selection);
    expect(controller.getSnapshot().pending?.requestId).toBe(id);
    expect(stored.get("pending")).not.toContain("latitude");
    expect(stored.get("pending")).not.toContain("capturedAt");
    await controller.refresh();
    await controller.retry();
    expect(deps.submit.mock.calls[1][0].requestId).toBe(id);
  });
  it("reconciles a persisted successful request after process restart", async () => {
    const { controller, deps, stored } = fixture();
    const pending: PendingPunch = { ...selection, requestId: id, kind: "in", expectedEntryId: null };
    stored.set("pending", JSON.stringify(pending));
    deps.resolve.mockResolvedValue({ timeEntryId: "entry", status: "replayed" });
    deps.load.mockResolvedValue({ ...empty, activeEntry: active, latestEntryId: active.id });
    await controller.refresh();
    expect(controller.getSnapshot().pending).toBeNull();
    expect(controller.getSnapshot().context?.activeEntry?.id).toBe("entry");
    expect(deps.submit).not.toHaveBeenCalled();
  });
  it("does not submit automatically on restart with an unresolved punch", async () => {
    const { controller, deps, stored } = fixture();
    stored.set("pending", JSON.stringify({ ...selection, requestId: id, kind: "in", expectedEntryId: null }));
    await controller.refresh();
    await controller.begin(selection);
    expect(controller.getSnapshot().pending?.requestId).toBe(id);
    expect(deps.submit).not.toHaveBeenCalled();
  });
  it("handles denied permission without clocking, and explicitly permits GPS-optional continuation", async () => {
    const { controller, deps } = fixture();
    deps.locate.mockRejectedValue(new PunchLocationError("denied"));
    await controller.refresh();
    await controller.begin(selection);
    expect(controller.getSnapshot().locationIssue?.kind).toBe("denied");
    expect(deps.submit).not.toHaveBeenCalled();
    await controller.retry(true);
    expect(deps.submit).toHaveBeenCalledWith(expect.objectContaining({ requestId: id }), null);
  });
  it("does not allow GPS-optional continuation for a required field clock-in", async () => {
    const { controller, deps } = fixture();
    deps.load.mockResolvedValue({ ...empty, fieldRequired: true });
    deps.locate.mockRejectedValue(new PunchLocationError("timeout"));
    await controller.refresh();
    await controller.begin({ ...selection, jobId: "job" });
    await controller.retry(true);
    expect(deps.submit).not.toHaveBeenCalled();
  });
  it("closes the authoritative expected entry and allows optional out GPS", async () => {
    const { controller, deps } = fixture();
    deps.load.mockResolvedValue({ ...empty, activeEntry: active, latestEntryId: active.id, fieldRequired: true });
    deps.locate.mockRejectedValue(new PunchLocationError("unavailable"));
    await controller.refresh();
    await controller.begin(selection);
    await controller.retry(true);
    expect(deps.submit).toHaveBeenCalledWith(expect.objectContaining({ kind: "out", expectedEntryId: "entry" }), null);
  });
  it("does not bypass an existing active break", async () => {
    const { controller, deps } = fixture();
    deps.load.mockResolvedValue({ ...empty, activeEntry: active, hasOpenBreak: true });
    await controller.refresh();
    await controller.begin(selection);
    expect(controller.getSnapshot().error?.kind).toBe("break");
    expect(deps.submit).not.toHaveBeenCalled();
  });
  it("requires fresh backend state after a definite stale rejection", async () => {
    const { controller, deps, stored } = fixture();
    deps.submit.mockRejectedValue(new ClockError("stale"));
    await controller.refresh();
    await controller.begin(selection);
    expect(controller.getSnapshot()).toMatchObject({ phase: "error", context: null, pending: null });
    expect(stored.size).toBe(0);
  });
  it("does not submit when pending-request persistence fails", async () => {
    const { controller, deps } = fixture();
    deps.storage.setItem.mockRejectedValue(new Error("disk full"));
    await controller.refresh();
    await controller.begin(selection);
    expect(deps.submit).not.toHaveBeenCalled();
    expect(controller.getSnapshot().phase).toBe("error");
  });
  it("restores external clock-out changes on resume refresh", async () => {
    const { controller, deps } = fixture();
    deps.load.mockResolvedValueOnce({ ...empty, activeEntry: active }).mockResolvedValueOnce(empty);
    await controller.refresh();
    expect(controller.getSnapshot().context?.activeEntry).not.toBeNull();
    await controller.refresh();
    expect(controller.getSnapshot().context?.activeEntry).toBeNull();
  });
});
describe("foreground one-shot location", () => {
  function adapter(): LocationAdapter {
    return {
      getPermission: vi.fn(async () => ({ granted: true, canAskAgain: true })),
      requestPermission: vi.fn(async () => ({ granted: true, canAskAgain: true })),
      servicesEnabled: vi.fn(async () => true),
      currentPosition: vi.fn(async () => ({ coords: { latitude: 40, longitude: -74, accuracy: 10 }, timestamp: Date.now() })),
    };
  }
  it("captures one reading with a sample timestamp", async () => {
    const api = adapter();
    expect(await capturePunchLocation(api)).toMatchObject({ latitude: 40, longitude: -74, accuracyM: 10 });
    expect(api.currentPosition).toHaveBeenCalledTimes(1);
    expect(api.requestPermission).not.toHaveBeenCalled();
  });
  it("requests foreground permission only when needed", async () => {
    const api = adapter();
    vi.mocked(api.getPermission).mockResolvedValue({ granted: false, canAskAgain: true });
    await capturePunchLocation(api);
    expect(api.requestPermission).toHaveBeenCalledTimes(1);
  });
  it("handles permanent denial without another permission prompt", async () => {
    const api = adapter();
    vi.mocked(api.getPermission).mockResolvedValue({ granted: false, canAskAgain: false });
    await expect(capturePunchLocation(api)).rejects.toMatchObject({ kind: "restricted" });
    expect(api.requestPermission).not.toHaveBeenCalled();
    expect(api.currentPosition).not.toHaveBeenCalled();
  });
  it("handles temporary denial", async () => {
    const api = adapter();
    vi.mocked(api.getPermission).mockResolvedValue({ granted: false, canAskAgain: true });
    vi.mocked(api.requestPermission).mockResolvedValue({ granted: false, canAskAgain: true });
    await expect(capturePunchLocation(api)).rejects.toMatchObject({ kind: "denied" });
  });
  it("handles unavailable GPS and sanitizes native failures", async () => {
    const api = adapter();
    vi.mocked(api.servicesEnabled).mockResolvedValue(false);
    await expect(capturePunchLocation(api)).rejects.toMatchObject({ kind: "unavailable" });
    vi.mocked(api.servicesEnabled).mockResolvedValue(true);
    vi.mocked(api.currentPosition).mockRejectedValue(new Error("native private details"));
    await expect(capturePunchLocation(api)).rejects.toMatchObject({ kind: "failed" });
  });
  it("rejects stale device readings", async () => {
    const api = adapter();
    vi.mocked(api.currentPosition).mockResolvedValue({ coords: { latitude: 40, longitude: -74, accuracy: 10 }, timestamp: 0 });
    await expect(capturePunchLocation(api)).rejects.toMatchObject({ kind: "failed" });
  });
  it("times out instead of leaving the punch spinner forever", async () => {
    const api = adapter();
    vi.mocked(api.currentPosition).mockImplementation(() => new Promise(() => {}));
    await expect(capturePunchLocation(api, 5)).rejects.toMatchObject({ kind: "timeout" });
  });
});
describe("clock presentation and errors", () => {
  it("formats elapsed time and clamps a device clock earlier than clock-in", () => {
    expect(elapsedTime(active, new Date("2026-09-03T13:17:00Z"))).toBe("2h 14m elapsed");
    expect(elapsedTime(active, new Date("2026-09-03T10:00:00Z"))).toBe("0h 0m elapsed");
    expect(elapsedTime(active, new Date("2026-09-04T13:17:00Z"))).toBe("26h 14m elapsed");
  });
  it("does not expose raw database messages", () => {
    expect(clockFailure({ code: "P0001", message: "raw private SQL details" }, true).message).not.toContain("SQL");
    expect(clockFailure({ code: "40001" }, true).kind).toBe("stale");
    expect(clockFailure({ code: "PGRST202" }, true).kind).toBe("setup");
    expect(clockFailure({}, true).kind).toBe("uncertain");
  });
});

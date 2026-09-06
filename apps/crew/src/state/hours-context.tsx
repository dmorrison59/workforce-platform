import { useFocusEffect } from "expo-router";
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";

import { getSupabaseClient } from "@/lib/supabase";
import { weekStartFor } from "@/lib/schedule-presentation";
import { loadCrewHours, HoursReadError } from "@/services/crew-hours";
import { useCrewClockState } from "@/state/clock-context";
import type { CrewContext } from "@/types/crew-context";
import type { CrewHoursData } from "@/types/hours";

export interface HoursState {
  status: "loading" | "ready" | "error";
  data: CrewHoursData | null;
  refreshing: boolean;
  error: HoursReadError | null;
}

interface CurrentHoursValue extends HoursState {
  weekStart: string;
  refresh(): void;
}

const CurrentHoursContext = createContext<CurrentHoursValue | null>(null);

function useHoursLoader(context: CrewContext, weekStart: string, enabled = true) {
  const [state, setState] = useState<HoursState>({ status: "loading", data: null, refreshing: false, error: null });
  const generation = useRef(0);
  const activeController = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    generation.current += 1;
    activeController.current?.abort();
  }, []);

  const load = useCallback(async (refreshing = false) => {
    if (!enabled) return;
    cancel();
    const request = generation.current;
    const controller = new AbortController();
    activeController.current = controller;
    setState({ status: "loading", data: null, refreshing, error: null });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const data = await Promise.race([
        loadCrewHours(getSupabaseClient(), context, weekStart, controller.signal),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new HoursReadError("read"));
          }, 20_000);
        }),
      ]);
      if (request === generation.current) setState({ status: "ready", data, refreshing: false, error: null });
    } catch (error) {
      if (request === generation.current) setState({
        status: "error", data: null, refreshing: false,
        error: error instanceof HoursReadError ? error : new HoursReadError("read"),
      });
    } finally {
      clearTimeout(timeout);
    }
  }, [cancel, context, enabled, weekStart]);

  useEffect(() => () => cancel(), [cancel]);
  return useMemo(() => ({ ...state, load, cancel }), [state, load, cancel]);
}

export function CrewHoursProvider({ context, children }: PropsWithChildren<{ context: CrewContext }>) {
  const [weekStart, setWeekStart] = useState(() => weekStartFor(new Date(), context.organization.timezone));
  const hours = useHoursLoader(context, weekStart);
  const { load, cancel } = hours;
  const clock = useCrewClockState();
  const clockFingerprint = `${clock.context?.latestEntryId ?? "none"}:${clock.context?.activeEntry?.id ?? "closed"}`;
  const previousClock = useRef(clockFingerprint);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const updateWeek = () => setWeekStart(weekStartFor(new Date(), context.organization.timezone));
    const interval = setInterval(updateWeek, 60_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        updateWeek();
        load();
      } else cancel();
    });
    return () => { clearInterval(interval); subscription.remove(); };
  }, [context.organization.timezone, cancel, load]);
  useEffect(() => {
    if (previousClock.current !== clockFingerprint) {
      previousClock.current = clockFingerprint;
      load();
    }
  }, [clockFingerprint, load]);

  const refresh = useCallback(() => { void load(true); }, [load]);
  const value = useMemo<CurrentHoursValue>(() => ({
    ...hours, weekStart, refresh,
  }), [hours, weekStart, refresh]);
  return <CurrentHoursContext.Provider value={value}>{children}</CurrentHoursContext.Provider>;
}

export function useCurrentCrewHours() {
  const value = useContext(CurrentHoursContext);
  if (!value) throw new Error("Hours provider is required");
  const { refresh } = value;
  useFocusEffect(useCallback(() => refresh(), [refresh]));
  return value;
}

export function useCrewHoursWeek(context: CrewContext, weekStart: string, enabled: boolean) {
  const hours = useHoursLoader(context, weekStart, enabled);
  const { load, cancel } = hours;
  useFocusEffect(useCallback(() => {
    if (!enabled) return undefined;
    void load();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
      else cancel();
    });
    return () => { subscription.remove(); cancel(); };
  }, [enabled, load, cancel]));
  return { ...hours, refresh: () => { void load(true); } };
}

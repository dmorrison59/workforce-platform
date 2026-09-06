import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { getSupabaseClient } from "@/lib/supabase";
import { loadCrewSchedule, ScheduleReadError, type CrewShift, type ScheduleWindow } from "@/services/crew-schedule";
import type { CrewContext } from "@/types/crew-context";

interface ScheduleState {
  key: string;
  status: "loading" | "ready" | "error";
  shifts: CrewShift[];
  refreshing: boolean;
  error: ScheduleReadError | null;
}

export function useScheduleClock() {
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(useCallback(() => {
    const update = () => setNow(new Date());
    update();
    const interval = setInterval(update, 60_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    return () => { clearInterval(interval); subscription.remove(); };
  }, []));
  return now;
}

export function useCrewSchedule(context: CrewContext, window: ScheduleWindow) {
  const key = `${context.user.id}:${context.organization.id}:${context.employee.id}:${window.start}:${window.end}`;
  const [state, setState] = useState<ScheduleState>({ key, status: "loading", shifts: [], refreshing: false, error: null });
  const generation = useRef(0);
  const activeController = useRef<AbortController | null>(null);
  const contextRef = useRef(context);
  useEffect(() => { contextRef.current = context; }, [context]);

  const cancel = useCallback(() => {
    generation.current += 1;
    activeController.current?.abort();
  }, []);

  const load = useCallback(async (refreshing = false) => {
    cancel();
    const request = generation.current;
    const controller = new AbortController();
    activeController.current = controller;
    setState({ key, status: "loading", shifts: [], refreshing, error: null });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const shifts = await Promise.race([
        loadCrewSchedule(getSupabaseClient(), contextRef.current, { start: window.start, end: window.end }, controller.signal),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new ScheduleReadError("read"));
          }, 20_000);
        }),
      ]);
      if (request === generation.current) setState({ key, status: "ready", shifts, refreshing: false, error: null });
    } catch (error) {
      if (request === generation.current) setState({
        key, status: "error", shifts: [], refreshing: false,
        error: error instanceof ScheduleReadError ? error : new ScheduleReadError("read"),
      });
    } finally {
      clearTimeout(timeout);
    }
  }, [cancel, key, window.start, window.end]);

  useFocusEffect(useCallback(() => {
    void load();
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void load();
      else cancel();
    });
    return () => { subscription.remove(); cancel(); };
  }, [load, cancel]));

  // Never briefly render the previous week/account while a new request starts.
  const current = state.key === key ? state : { key, status: "loading" as const, shifts: [], refreshing: false, error: null };
  return { ...current, refresh: () => void load(true), retry: () => void load() };
}

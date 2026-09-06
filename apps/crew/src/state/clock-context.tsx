import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { useFocusEffect } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from "react";
import { AppState } from "react-native";
import { getSupabaseClient } from "@/lib/supabase";
import { readPunchLocation } from "@/lib/native-punch-location";
import { clockApi } from "@/services/crew-clock";
import type { CrewContext } from "@/types/crew-context";
import { ClockController } from "./clock-controller";

const controllers = new Map<string, ClockController>();
const ClockContext = createContext<ClockController | null>(null);
export function CrewClockProvider({ context, children }: PropsWithChildren<{ context: CrewContext }>) {
  const key = `yardclock-pending-punch:${context.user.id}:${context.organization.id}:${context.employee.id}`;
  const [controller] = useState(() => {
    let existing = controllers.get(key);
    if (!existing) {
      existing = new ClockController({ ...clockApi(getSupabaseClient(), context), locate: readPunchLocation, newId: randomUUID, storage: AsyncStorage }, key);
      controllers.set(key, existing);
    }
    return existing;
  });
  useEffect(() => {
    void controller.refresh();
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void controller.refresh(); });
    return () => subscription.remove();
  }, [controller]);
  return <ClockContext.Provider value={controller}>{children}</ClockContext.Provider>;
}
export function useCrewClock() {
  const state = useCrewClockState();
  const { refresh } = state;
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return state;
}
export function useCrewClockState() {
  const controller = useContext(ClockContext);
  if (!controller) throw new Error("Clock provider is required");
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  return { ...state, refresh: controller.refresh, begin: controller.begin, retry: controller.retry };
}

import { useFocusEffect } from "expo-router";
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";

import { getSupabaseClient } from "@/lib/supabase";
import {
  cancelCrewTimeOff, createCrewTimeOff, loadCrewTimeOff, TimeOffError,
} from "@/services/crew-time-off";
import type { CrewContext } from "@/types/crew-context";
import type { CrewTimeOffRequest, TimeOffDraft } from "@/types/time-off";

interface TimeOffValue {
  status: "loading" | "ready" | "error";
  requests: CrewTimeOffRequest[] | null;
  refreshing: boolean;
  error: TimeOffError | null;
  actionError: TimeOffError | null;
  notice: string | null;
  submitting: boolean;
  cancellingId: string | null;
  refresh(): void;
  submit(draft: TimeOffDraft): Promise<boolean>;
  cancel(request: CrewTimeOffRequest): Promise<boolean>;
  clearFeedback(): void;
}

const TimeOffContext = createContext<TimeOffValue | null>(null);

export function CrewTimeOffProvider({ context, children }: PropsWithChildren<{ context: CrewContext }>) {
  const [status, setStatus] = useState<TimeOffValue["status"]>("loading");
  const [requests, setRequests] = useState<CrewTimeOffRequest[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<TimeOffError | null>(null);
  const [actionError, setActionError] = useState<TimeOffError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const mutationInFlight = useRef(false);

  const cancelLoad = useCallback(() => {
    generation.current += 1;
    controller.current?.abort();
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    cancelLoad();
    const request = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    if (!isRefresh) {
      setStatus("loading");
      setRequests(null);
    }
    setRefreshing(isRefresh);
    setError(null);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const data = await Promise.race([
        loadCrewTimeOff(getSupabaseClient(), context, abort.signal),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            abort.abort();
            reject(new TimeOffError("read"));
          }, 20_000);
        }),
      ]);
      if (request === generation.current) {
        setRequests(data);
        setStatus("ready");
      }
    } catch (caught) {
      if (request === generation.current) {
        setRequests(null);
        setError(caught instanceof TimeOffError ? caught : new TimeOffError("read"));
        setStatus("error");
      }
    } finally {
      clearTimeout(timeout);
      if (request === generation.current) setRefreshing(false);
    }
  }, [cancelLoad, context]);

  useEffect(() => {
    const initialLoad = setTimeout(() => { void load(); }, 0);
    return () => { clearTimeout(initialLoad); cancelLoad(); };
  }, [load, cancelLoad]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
      else cancelLoad();
    });
    return () => subscription.remove();
  }, [load, cancelLoad]);

  const submit = useCallback(async (draft: TimeOffDraft) => {
    if (mutationInFlight.current) return false;
    mutationInFlight.current = true;
    setSubmitting(true);
    setActionError(null);
    setNotice(null);
    try {
      await createCrewTimeOff(getSupabaseClient(), context, draft);
      setNotice("Time-off request submitted.");
      await load(true);
      return true;
    } catch (caught) {
      setActionError(caught instanceof TimeOffError ? caught : new TimeOffError("mutation"));
      return false;
    } finally {
      mutationInFlight.current = false;
      setSubmitting(false);
    }
  }, [context, load]);

  const cancel = useCallback(async (request: CrewTimeOffRequest) => {
    if (mutationInFlight.current) return false;
    mutationInFlight.current = true;
    setCancellingId(request.id);
    setActionError(null);
    setNotice(null);
    try {
      await cancelCrewTimeOff(getSupabaseClient(), context, request);
      setRequests((current) => current?.map((item) => item.id === request.id
        ? { ...item, status: "cancelled" } : item) ?? null);
      setNotice("Time-off request cancelled.");
      await load(true);
      return true;
    } catch (caught) {
      setActionError(caught instanceof TimeOffError ? caught : new TimeOffError("mutation"));
      return false;
    } finally {
      mutationInFlight.current = false;
      setCancellingId(null);
    }
  }, [context, load]);

  const clearFeedback = useCallback(() => { setActionError(null); setNotice(null); }, []);
  const refresh = useCallback(() => { void load(true); }, [load]);
  const value = useMemo<TimeOffValue>(() => ({
    status, requests, refreshing, error, actionError, notice, submitting, cancellingId,
    refresh, submit, cancel, clearFeedback,
  }), [status, requests, refreshing, error, actionError, notice, submitting, cancellingId,
    refresh, submit, cancel, clearFeedback]);
  return <TimeOffContext.Provider value={value}>{children}</TimeOffContext.Provider>;
}

export function useCrewTimeOff() {
  const value = useContext(TimeOffContext);
  if (!value) throw new Error("Time Off provider is required");
  const { refresh } = value;
  useFocusEffect(useCallback(() => refresh(), [refresh]));
  return value;
}

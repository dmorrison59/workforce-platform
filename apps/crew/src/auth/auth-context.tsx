import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState, Platform } from "react-native";

import { getSupabaseClient } from "@/lib/supabase";
import { loadCrewContext } from "@/services/crew-context";
import type { CrewContext } from "@/types/crew-context";

type AuthStatus = "loading" | "signedOut" | "ready" | "error";

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  crewContext: CrewContext | null;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  retry(): Promise<void>;
  clearError(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    session: null,
    crewContext: null,
    error: null,
  });
  const requestId = useRef(0);

  const hydrate = useCallback(async (session: Session | null) => {
    const activeRequest = ++requestId.current;

    if (!session) {
      setState({ status: "signedOut", session: null, crewContext: null, error: null });
      return;
    }

    setState({ status: "loading", session, crewContext: null, error: null });

    try {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) throw new Error("Your session could not be verified. Please sign in again.");

      const crewContext = await loadCrewContext(client, data.user);
      if (activeRequest !== requestId.current) return;
      setState({ status: "ready", session, crewContext, error: null });
    } catch (error) {
      if (activeRequest !== requestId.current) return;
      setState({ status: "error", session, crewContext: null, error: messageFor(error) });
    }
  }, []);

  useEffect(() => {
    let authSubscription: { unsubscribe(): void } | null = null;
    let appStateSubscription: { remove(): void } | null = null;

    try {
      const client = getSupabaseClient();
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        setTimeout(() => void hydrate(session), 0);
      });
      authSubscription = data.subscription;

      void client.auth.getSession().then(({ data: sessionData, error }) => {
        if (error) {
          setState({
            status: "error",
            session: null,
            crewContext: null,
            error: "Your saved session could not be restored.",
          });
          return;
        }
        void hydrate(sessionData.session);
      });

      if (Platform.OS !== "web") {
        if (AppState.currentState === "active") client.auth.startAutoRefresh();
        appStateSubscription = AppState.addEventListener("change", (nextState) => {
          if (nextState === "active") client.auth.startAutoRefresh();
          else client.auth.stopAutoRefresh();
        });
      }
    } catch (error) {
      setState({
        status: "error",
        session: null,
        crewContext: null,
        error: messageFor(error),
      });
    }

    return () => {
      if (Platform.OS !== "web") {
        try {
          getSupabaseClient().auth.stopAutoRefresh();
        } catch {
          // The client was never created because environment validation failed.
        }
      }
      authSubscription?.unsubscribe();
      appStateSubscription?.remove();
    };
  }, [hydrate]);

  const signIn = useCallback(async (email: string, password: string) => {
    setState({ status: "loading", session: null, crewContext: null, error: null });
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error || !data.session) throw new Error("Email or password was not recognized.");
      await hydrate(data.session);
    } catch (error) {
      setState({
        status: "signedOut",
        session: null,
        crewContext: null,
        error: messageFor(error),
      });
    }
  }, [hydrate]);

  const signOut = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading", error: null }));
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) throw error;
      setState({ status: "signedOut", session: null, crewContext: null, error: null });
    } catch {
      setState((current) => ({
        ...current,
        status: current.session ? "ready" : "signedOut",
        error: "We could not sign you out. Please try again.",
      }));
    }
  }, []);

  const retry = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading", error: null }));
    try {
      const { data, error } = await getSupabaseClient().auth.getSession();
      if (error) throw error;
      await hydrate(data.session);
    } catch (error) {
      setState((current) => ({
        ...current,
        status: "error",
        error: messageFor(error),
      }));
    }
  }, [hydrate]);

  const clearError = useCallback(() => {
    setState((current) => ({ ...current, error: null }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, retry, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}

import { Redirect, Tabs } from "expo-router";

import { useAuth } from "@/auth/auth-context";
import { LoadingScreen } from "@/components/loading-screen";
import { colors } from "@/theme";
import { CrewClockProvider } from "@/state/clock-context";
import { CrewHoursProvider } from "@/state/hours-context";

export default function CrewLayout() {
  const auth = useAuth();

  if (auth.status === "loading") return <LoadingScreen />;
  if (!auth.session) return <Redirect href="/sign-in" />;
  if (auth.status !== "ready" || !auth.crewContext) return <Redirect href="/" />;

  return (
    <CrewClockProvider key={`${auth.crewContext.user.id}:${auth.crewContext.organization.id}:${auth.crewContext.employee.id}`} context={auth.crewContext}>
    <CrewHoursProvider context={auth.crewContext}>
    <Tabs
      initialRouteName="today"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarStyle: { borderTopColor: colors.border, height: 66, paddingBottom: 8, paddingTop: 7 },
      }}
    >
      <Tabs.Screen name="today" options={{ title: "Today" }} />
      <Tabs.Screen name="schedule" options={{ title: "Schedule" }} />
      <Tabs.Screen name="clock" options={{ title: "Clock" }} />
      <Tabs.Screen name="hours" options={{ title: "Hours" }} />
      <Tabs.Screen name="time-off" options={{ title: "Time Off" }} />
    </Tabs>
    </CrewHoursProvider>
    </CrewClockProvider>
  );
}

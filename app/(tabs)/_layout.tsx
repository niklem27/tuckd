import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router/js-tabs";
import { usePalette } from "@/lib/theme";

export default function TabsLayout() {
  const { colors } = usePalette();
  const icon = (name: string) =>
    function TabIcon({ color, size, focused }: { color: any; size: number; focused: boolean }) {
      return <Ionicons name={(focused ? name : `${name}-outline`) as any} size={size} color={color} />;
    };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="inbox" options={{ title: "Inbox", tabBarIcon: icon("albums"), tabBarButtonTestID: "tab-inbox", tabBarAccessibilityLabel: "Inbox tab" }} />
      <Tabs.Screen name="today" options={{ title: "Today", tabBarIcon: icon("sunny"), tabBarButtonTestID: "tab-today", tabBarAccessibilityLabel: "Today tab" }} />
      <Tabs.Screen name="saved" options={{ title: "Saved", tabBarIcon: icon("bookmark"), tabBarButtonTestID: "tab-saved", tabBarAccessibilityLabel: "Saved tab" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: icon("settings"), tabBarButtonTestID: "tab-settings", tabBarAccessibilityLabel: "Settings tab" }} />
    </Tabs>
  );
}

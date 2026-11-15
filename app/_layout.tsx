import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthGate } from "@/components/AuthGate";
import { IngestProvider } from "@/components/IngestProvider";
import { usePalette } from "@/lib/theme";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, { unsavedChangesWarning: false });

const secureStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

export default function RootLayout() {
  const { colors, dark } = usePalette();
  const base = dark ? DarkTheme : DefaultTheme;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ConvexAuthProvider client={convex} storage={Platform.OS === "web" ? undefined : secureStorage}>
        <ThemeProvider value={{ ...base, colors: { ...base.colors, background: colors.background, card: colors.surface, primary: colors.accent } }}>
          <StatusBar style={dark ? "light" : "dark"} />
          <AuthGate>
            <IngestProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(onboarding)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="item/[id]"
                  options={{ presentation: "modal", headerShown: true, title: "", headerTransparent: false }}
                />
              </Stack>
            </IngestProvider>
          </AuthGate>
        </ThemeProvider>
      </ConvexAuthProvider>
    </GestureHandlerRootView>
  );
}

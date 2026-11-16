import * as Linking from "expo-linking";
import { router, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

let shown = false;
let returningFromLink = false;

export const introShownThisLaunch = () => shown;

export function markIntroShown() {
  shown = true;
}

export function openExternal(url: string) {
  returningFromLink = true;
  return Linking.openURL(url);
}

export function useIntroOnEveryOpen(enabled: boolean) {
  const segments = useSegments();
  const onIntro = useRef(false);
  onIntro.current = segments[0] === "(onboarding)";

  useEffect(() => {
    if (!enabled) return;
    let backgrounded = false;
    const links = Linking.addEventListener("url", () => {
      returningFromLink = true;
    });
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "background") backgrounded = true;
      if (state !== "active" || !backgrounded) return;
      backgrounded = false;
      setTimeout(() => {
        const skip = returningFromLink || onIntro.current;
        returningFromLink = false;
        if (skip) return;
        shown = false;
        if (router.canDismiss()) router.dismissAll();
        router.replace("/(onboarding)");
      }, 300);
    });
    return () => {
      appState.remove();
      links.remove();
    };
  }, [enabled]);
}

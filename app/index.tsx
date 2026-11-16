import { useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { api } from "@/convex/_generated/api";
import { introShownThisLaunch } from "@/lib/intro";
import { isDemoMode } from "@/lib/theme";

export default function Index() {
  const me = useQuery(api.profile.me);
  if (me === undefined) return null;
  const showIntro = isDemoMode ? !introShownThisLaunch() : !me?.profile?.onboarded;
  return <Redirect href={showIntro ? "/(onboarding)" : "/(tabs)/inbox"} />;
}

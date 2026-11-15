import { useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { api } from "@/convex/_generated/api";

export default function Index() {
  const me = useQuery(api.profile.me);
  if (me === undefined) return null;
  return <Redirect href={me?.profile?.onboarded ? "/(tabs)/inbox" : "/(onboarding)"} />;
}

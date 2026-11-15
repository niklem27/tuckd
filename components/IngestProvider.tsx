import { useConvexAuth, useQuery } from "convex/react";
import { createContext, ReactNode, useContext, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { api } from "@/convex/_generated/api";
import { useIngest } from "@/lib/ingest";

type IngestValue = ReturnType<typeof useIngest>;

const IngestContext = createContext<IngestValue | null>(null);

export function IngestProvider({ children }: { children: ReactNode }) {
  const ingest = useIngest();
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.profile.me, isAuthenticated ? {} : "skip");
  const ready = !!me?.profile?.onboarded;
  const syncRef = useRef(ingest.sync);
  useEffect(() => {
    syncRef.current = ingest.sync;
  }, [ingest.sync]);

  useEffect(() => {
    if (!ready) return;
    syncRef.current().catch(() => {});
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") syncRef.current().catch(() => {});
    });
    return () => sub.remove();
  }, [ready]);

  return <IngestContext.Provider value={ingest}>{children}</IngestContext.Provider>;
}

export function useIngestContext() {
  const value = useContext(IngestContext);
  if (!value) throw new Error("useIngestContext must be used inside IngestProvider");
  return value;
}

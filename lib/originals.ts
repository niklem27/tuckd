import { useConvexAuth, useMutation, useQuery } from "convex/react";
import * as MediaLibrary from "expo-media-library/legacy";
import { useCallback, useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

type Original = { screenshotId: Id<"screenshots">; localAssetId: string };

export async function deleteOriginals(rows: Original[], markDeleted: (args: { screenshotIds: Id<"screenshots">[] }) => Promise<unknown>) {
  if (rows.length === 0) return 0;
  const perm = await MediaLibrary.requestPermissionsAsync(false, ["photo"]);
  if (!perm.granted) throw new Error("Photo access is needed to delete originals.");
  const ok = await MediaLibrary.deleteAssetsAsync(rows.map((r) => r.localAssetId));
  if (!ok) return 0;
  await markDeleted({ screenshotIds: rows.map((r) => r.screenshotId) });
  return rows.length;
}

export function useAutoDeleteOriginals() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.profile.me, isAuthenticated ? {} : "skip");
  const enabled = !!me?.profile?.deleteOriginals;
  const finished = useQuery(api.screenshots.deletableOriginals, enabled ? { scope: "finished" } : "skip");
  const markDeleted = useMutation(api.screenshots.markOriginalsDeleted);
  const busy = useRef(false);
  const run = useCallback(async () => {
    if (!finished?.length || busy.current) return;
    busy.current = true;
    try {
      await deleteOriginals(finished, markDeleted);
    } catch (err) {
      console.warn("Auto-delete originals failed", err);
    } finally {
      busy.current = false;
    }
  }, [finished, markDeleted]);
  return { pending: finished?.length ?? 0, run };
}

export function useAutoDeleteOnFocus(active: boolean) {
  const { pending, run } = useAutoDeleteOriginals();
  const last = useRef(0);
  useEffect(() => {
    if (!active || pending === 0 || Date.now() - last.current < 60_000) return;
    last.current = Date.now();
    run();
  }, [active, pending, run]);
}

import { useMutation, useQuery } from "convex/react";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library/legacy";
import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const DAY = 24 * 60 * 60 * 1000;
const FIRST_RUN_WINDOW = 30 * DAY;
const MAX_IMPORT = 50;
const CONCURRENCY = 3;

export const DEMO_SCREENSHOTS = [
  { key: "jazz-night-flyer", module: require("@/assets/demo/jazz-night-flyer.png") },
  { key: "ramen-instagram", module: require("@/assets/demo/ramen-instagram.png") },
  { key: "sneaker-product", module: require("@/assets/demo/sneaker-product.png") },
  { key: "pasta-recipe", module: require("@/assets/demo/pasta-recipe.png") },
  { key: "concert-ticket", module: require("@/assets/demo/concert-ticket.png") },
  { key: "job-posting", module: require("@/assets/demo/job-posting.png") },
  { key: "funny-tweet", module: require("@/assets/demo/funny-tweet.png") },
  { key: "bank-balance", module: require("@/assets/demo/bank-balance.png") },
];

type Source = { assetId: string; takenAt: number; uri: string; width: number; height: number };

async function resize(uri: string, width: number, height: number, longEdge: number, compress: number) {
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > longEdge) {
    ctx.resize(width >= height ? { width: longEdge } : { height: longEdge });
  }
  const image = await ctx.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress });
  return result.uri;
}

async function upload(url: string, fileUri: string) {
  const res = await FileSystem.uploadAsync(url, fileUri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { "Content-Type": "image/jpeg" },
  });
  if (res.status !== 200) throw new Error(`Upload failed (${res.status})`);
  return JSON.parse(res.body).storageId as Id<"_storage">;
}

async function runPool<T>(items: T[], worker: (item: T) => Promise<void>) {
  let next = 0;
  const lanes = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item).catch((err) => console.warn("Screenshot import failed", err));
    }
  });
  await Promise.all(lanes);
}

export type PhotoAccess = "all" | "limited" | "denied" | "undetermined";

export async function getPhotoAccess(): Promise<PhotoAccess> {
  const res = await MediaLibrary.getPermissionsAsync(false, ["photo"]);
  if (res.status === "undetermined") return "undetermined";
  if (!res.granted) return "denied";
  return res.accessPrivileges === "limited" ? "limited" : "all";
}

export async function requestPhotoAccess(): Promise<PhotoAccess> {
  const res = await MediaLibrary.requestPermissionsAsync(false, ["photo"]);
  if (!res.granted) return "denied";
  return res.accessPrivileges === "limited" ? "limited" : "all";
}

export async function presentLimitedPicker() {
  await MediaLibrary.presentPermissionsPickerAsync(["photo"]);
}

async function findScreenshots(since: number): Promise<MediaLibrary.Asset[]> {
  const base = {
    mediaType: MediaLibrary.MediaType.photo,
    createdAfter: since,
    first: MAX_IMPORT,
    sortBy: [[MediaLibrary.SortBy.creationTime, false]] as MediaLibrary.SortByValue[],
  };
  if (Platform.OS === "ios") {
    const page = await MediaLibrary.getAssetsAsync({ ...base, mediaSubtypes: ["screenshot"] });
    return page.assets;
  }
  const album = await MediaLibrary.getAlbumAsync("Screenshots");
  if (!album) return [];
  const page = await MediaLibrary.getAssetsAsync({ ...base, album });
  return page.assets;
}

export function useIngest() {
  const register = useMutation(api.screenshots.registerScreenshot);
  const attach = useMutation(api.screenshots.attachUpload);
  const upsertProfile = useMutation(api.profile.upsert);
  const me = useQuery(api.profile.me);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const importSources = useCallback(
    async (load: () => Promise<Source[]>) => {
      if (busy.current) return 0;
      busy.current = true;
      setError(null);
      let imported = 0;
      try {
        const sources = await load();
        if (sources.length === 0) return 0;
        setUploading({ done: 0, total: sources.length });
        await runPool(sources, async (src) => {
          try {
            const reg = await register({ assetId: src.assetId, takenAt: src.takenAt });
            if ("alreadyExists" in reg) return;
            const [full, thumb] = await Promise.all([
              resize(src.uri, src.width, src.height, 1280, 0.7),
              resize(src.uri, src.width, src.height, 400, 0.6),
            ]);
            const [storageId, thumbStorageId] = await Promise.all([
              upload(reg.uploadUrl, full),
              upload(reg.thumbUploadUrl, thumb),
            ]);
            await attach({ screenshotId: reg.screenshotId, storageId, thumbStorageId });
            imported++;
          } finally {
            setUploading((u) => (u ? { ...u, done: u.done + 1 } : u));
          }
        });
        return imported;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return imported;
      } finally {
        busy.current = false;
        setUploading(null);
      }
    },
    [register, attach],
  );

  const sync = useCallback(async () => {
    const access = await getPhotoAccess();
    if (access !== "all" && access !== "limited") return 0;
    const startedAt = Date.now();
    const lastSyncedAt = me?.profile?.lastSyncedAt;
    const count = await importSources(async () => {
      const assets = await findScreenshots(lastSyncedAt ?? startedAt - FIRST_RUN_WINDOW);
      const sources: Source[] = [];
      for (const asset of assets) {
        const info = await MediaLibrary.getAssetInfoAsync(asset);
        const uri = info.localUri ?? asset.uri;
        if (!uri) continue;
        sources.push({ assetId: asset.id, takenAt: asset.creationTime, uri, width: asset.width, height: asset.height });
      }
      return sources;
    });
    await upsertProfile({ lastSyncedAt: startedAt });
    return count;
  }, [importSources, me?.profile?.lastSyncedAt, upsertProfile]);

  const loadDemo = useCallback(async () => {
    const now = Date.now();
    return await importSources(async () => {
      const assets = await Asset.loadAsync(DEMO_SCREENSHOTS.map((d) => d.module));
      return assets.map((asset, i) => ({
        assetId: `demo:${DEMO_SCREENSHOTS[i].key}`,
        takenAt: now - i * 60_000,
        uri: asset.localUri ?? asset.uri,
        width: asset.width ?? 591,
        height: asset.height ?? 1280,
      }));
    });
  }, [importSources]);

  const scanPhotos = useCallback(
    async (photos: { assetId?: string | null; uri: string; width: number; height: number }[]) => {
      const now = Date.now();
      return await importSources(async () =>
        photos.map((p, i) => ({
          assetId: p.assetId ? `photo:${p.assetId}` : `photo:${p.uri}`,
          takenAt: now - i,
          uri: p.uri,
          width: p.width,
          height: p.height,
        })),
      );
    },
    [importSources],
  );

  return { sync, loadDemo, scanPhotos, uploading, error };
}

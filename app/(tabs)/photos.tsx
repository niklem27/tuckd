import { Ionicons } from "@expo/vector-icons";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library/legacy";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { useIngestContext } from "@/components/IngestProvider";
import { TypeChip } from "@/components/TypeChip";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { usePalette } from "@/lib/theme";

const MAX_PICK = 10;

export default function PhotosScreen() {
  const { colors } = usePalette();
  const { isAuthenticated } = useConvexAuth();
  const scans = useQuery(api.screenshots.photoScans, isAuthenticated ? {} : "skip");
  const markDeleted = useMutation(api.screenshots.markOriginalDeleted);
  const { scanPhotos, uploading } = useIngestContext();
  const [freeing, setFreeing] = useState(false);

  const pick = async (source: "library" | "camera") => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 1,
      allowsMultipleSelection: source === "library",
      selectionLimit: MAX_PICK,
    };
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Camera access is off", "Turn it on in Settings to snap posters directly.");
        return;
      }
    }
    const result =
      source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    await scanPhotos(result.assets.map((a) => ({ assetId: a.assetId, uri: a.uri, width: a.width, height: a.height })));
  };

  const freeable = (scans ?? []).filter((s) => s.localAssetId && !s.originalDeleted && (s.status === "done" || s.status === "skipped"));

  const deleteOriginals = async (rows: typeof freeable) => {
    if (rows.length === 0) return;
    setFreeing(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(false, ["photo"]);
      if (!perm.granted) throw new Error("Photo access is needed to delete originals.");
      const ok = await MediaLibrary.deleteAssetsAsync(rows.map((r) => r.localAssetId!));
      if (!ok) return;
      await Promise.all(rows.map((r) => markDeleted({ screenshotId: r._id as Id<"screenshots"> })));
    } catch (err) {
      Alert.alert("Couldn't delete", err instanceof Error ? err.message : String(err));
    } finally {
      setFreeing(false);
    }
  };

  const freedCount = (scans ?? []).filter((s) => s.originalDeleted).length;

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[styles.h1, { color: colors.text }]}>Photos</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>
        Snap or pick photos of posters, flyers, menus and signs. Snapback reads them, then you can delete the originals to free space.
      </Text>
      <View style={styles.actions}>
        <Button label="Snap a photo" icon="camera-outline" onPress={() => pick("camera")} testID="btn-snap-photo" style={{ flex: 1 }} />
        <Button
          label="Pick photos"
          icon="images-outline"
          variant="secondary"
          onPress={() => pick("library")}
          loading={!!uploading}
          testID="btn-pick-photos"
          style={{ flex: 1 }}
        />
      </View>
      {freeable.length > 0 ? (
        <View style={[styles.freeBar, { backgroundColor: colors.keep + "18", borderColor: colors.keep + "40" }]} testID="free-space-bar">
          <Ionicons name="leaf-outline" size={18} color={colors.keep} />
          <Text style={[styles.freeText, { color: colors.text }]}>
            {freeable.length} sorted original{freeable.length === 1 ? "" : "s"} still on your phone
          </Text>
          <Pressable
            testID="btn-free-all"
            accessibilityRole="button"
            accessibilityLabel="Delete sorted originals to free space"
            onPress={() => deleteOriginals(freeable)}
            disabled={freeing}
          >
            <Text style={{ color: colors.keep, fontWeight: "800" }}>{freeing ? "Freeing…" : "Free up"}</Text>
          </Pressable>
        </View>
      ) : freedCount > 0 ? (
        <Text style={[styles.freed, { color: colors.muted }]} testID="freed-note">
          {freedCount} original{freedCount === 1 ? "" : "s"} deleted from your phone. Snapback keeps the card.
        </Text>
      ) : null}
      {scans === undefined ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : scans.length === 0 ? (
        <EmptyState icon="scan-outline" title="No photos scanned yet" body="Try a gig poster, a restaurant menu or a sign with a date on it." testID="photos-empty" />
      ) : (
        <FlatList
          data={scans}
          keyExtractor={(s) => s._id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item: scan, index }) => (
            <Pressable
              testID={`photo-scan-${index}`}
              accessibilityRole="button"
              accessibilityLabel={scan.item ? scan.item.title : `Photo, ${scan.status}`}
              disabled={!scan.item}
              onPress={() => scan.item && router.push({ pathname: "/item/[id]", params: { id: scan.item._id } })}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]}>
                {scan.thumbUrl ? <Image source={{ uri: scan.thumbUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                {scan.item ? (
                  <>
                    <TypeChip type={scan.item.type} small />
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                      {scan.item.title}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>
                      {scan.item.state === "inbox" ? "In your Inbox" : scan.item.state === "archived" ? "Archived" : "Saved"}
                      {scan.originalDeleted ? " · original deleted" : ""}
                    </Text>
                  </>
                ) : (
                  <Text style={{ color: colors.muted, fontSize: 15 }}>
                    {scan.status === "skipped"
                      ? "Skipped: looked private"
                      : scan.status === "failed"
                        ? "Couldn't read this one"
                        : "Reading…"}
                  </Text>
                )}
              </View>
              {scan.localAssetId && !scan.originalDeleted && (scan.status === "done" || scan.status === "skipped") ? (
                <Pressable
                  testID={`btn-delete-original-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel="Delete original photo"
                  hitSlop={8}
                  onPress={() => deleteOriginals([scan])}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.muted} />
                </Pressable>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  h1: { fontSize: 34, fontWeight: "800", letterSpacing: -0.8, paddingHorizontal: 20, paddingTop: 8 },
  sub: { fontSize: 15, lineHeight: 21, paddingHorizontal: 20, marginTop: 4 },
  actions: { flexDirection: "row", gap: 10, padding: 20 },
  freeBar: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, marginBottom: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
  freeText: { flex: 1, fontSize: 14, fontWeight: "600" },
  freed: { marginHorizontal: 20, marginBottom: 12, fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, marginHorizontal: 20, marginBottom: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  thumb: { width: 56, height: 72, borderRadius: 10, overflow: "hidden" },
  title: { fontSize: 16, fontWeight: "700" },
});

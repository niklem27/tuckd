import { useConvexAuth, useQuery } from "convex/react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useIngestContext } from "@/components/IngestProvider";
import { api } from "@/convex/_generated/api";
import { usePalette } from "@/lib/theme";

export function SyncBanner() {
  const { colors } = usePalette();
  const { isAuthenticated } = useConvexAuth();
  const status = useQuery(api.screenshots.syncStatus, isAuthenticated ? {} : "skip");
  const { uploading } = useIngestContext();
  const sorting = status?.sorting ?? 0;
  const pendingUploads = uploading ? uploading.total - uploading.done : 0;
  const count = Math.max(sorting, pendingUploads);
  if (count === 0) return null;
  const label = `Sorting ${count} screenshot${count === 1 ? "" : "s"}…`;
  return (
    <Animated.View entering={FadeInUp} exiting={FadeOutUp}>
      <View
        testID="sync-banner"
        accessibilityLabel={label}
        accessibilityRole="progressbar"
        style={[styles.banner, { backgroundColor: colors.accent + "18", borderColor: colors.accent + "40" }]}
      >
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  text: { fontSize: 15, fontWeight: "600" },
});

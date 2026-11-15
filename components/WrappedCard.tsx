import { Ionicons } from "@expo/vector-icons";
import { useConvexAuth, useQuery } from "convex/react";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { api } from "@/convex/_generated/api";
import { typeMeta } from "@/lib/theme";

const NOUNS: Record<string, [string, string]> = {
  event: ["event", "events"],
  place: ["place", "places"],
  product: ["product", "products"],
  recipe: ["recipe", "recipes"],
  todo: ["to-do", "to-dos"],
  memory: ["memory", "memories"],
};

const noun = (type: string, n: number) => NOUNS[type][n === 1 ? 0 : 1];

export function WrappedCard() {
  const { isAuthenticated } = useConvexAuth();
  const wrapped = useQuery(api.items.wrapped, isAuthenticated ? {} : "skip");
  const cardRef = useRef<any>(null);
  const [sharing, setSharing] = useState(false);
  if (!wrapped || wrapped.saved === 0 || !wrapped.top) return null;
  const { top } = wrapped;
  const headline = `You saved ${top.saved} ${noun(top.type, top.saved)} and acted on ${top.acted}`;

  const share = async () => {
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 1, result: "tmpfile" });
      if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this device.");
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "My Screenshot Wrapped", UTI: "public.png" });
    } catch (err) {
      Alert.alert("Couldn't share", err instanceof Error ? err.message : String(err));
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View ref={cardRef} collapsable={false} style={styles.card} testID="wrapped-card" accessibilityLabel={`Screenshot Wrapped. ${headline}`}>
        <Text style={styles.kicker}>SCREENSHOT WRAPPED</Text>
        <Text style={styles.headline}>{headline}</Text>
        <View style={styles.rows}>
          {wrapped.rows.map((row) => (
            <View key={row.type} style={styles.row} testID={`wrapped-row-${row.type}`}>
              <View style={[styles.dot, { backgroundColor: typeMeta[row.type].color }]}>
                <Ionicons name={typeMeta[row.type].icon as any} size={12} color="#fff" />
              </View>
              <Text style={styles.rowLabel}>{typeMeta[row.type].plural}</Text>
              <Text style={styles.rowValue}>
                {row.saved} saved · {row.acted} acted
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>
          {wrapped.screenshots} screenshots sorted with Snapback
        </Text>
      </View>
      <Pressable
        testID="btn-share-wrapped"
        accessibilityRole="button"
        accessibilityLabel="Share Screenshot Wrapped"
        onPress={share}
        disabled={sharing}
        style={({ pressed }) => [styles.share, { opacity: pressed || sharing ? 0.7 : 1 }]}
      >
        <Ionicons name="share-outline" size={16} color="#fff" />
        <Text style={styles.shareText}>{sharing ? "Preparing…" : "Share"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginTop: 14 },
  card: { backgroundColor: "#1E1033", borderRadius: 20, padding: 20, gap: 12, overflow: "hidden" },
  kicker: { color: "#C4B5FD", fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  headline: { color: "#fff", fontSize: 24, fontWeight: "800", letterSpacing: -0.4, lineHeight: 29 },
  rows: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rowLabel: { color: "#fff", fontSize: 15, fontWeight: "700", flex: 1 },
  rowValue: { color: "#DDD6FE", fontSize: 14, fontWeight: "600" },
  footer: { color: "#A78BFA", fontSize: 12, fontWeight: "600", marginTop: 4 },
  share: { position: "absolute", top: 14, right: 14, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#ffffff26", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  shareText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

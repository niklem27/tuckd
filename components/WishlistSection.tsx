import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { productUrl } from "@/lib/actions";
import { typeMeta, usePalette } from "@/lib/theme";

type WishlistEntry = { _id: string; title: string; price?: string; url?: string; thumbUrl: string | null };

export function WishlistSection({ items }: { items: WishlistEntry[] }) {
  const { colors } = usePalette();
  const meta = typeMeta.product;
  if (items.length === 0) return null;
  return (
    <View style={{ marginTop: 18, gap: 10 }} testID="wishlist-section">
      <View style={styles.header}>
        <Ionicons name="heart" size={16} color={meta.color} />
        <Text style={[styles.title, { color: colors.text }]}>Wishlist</Text>
        <Text style={{ color: colors.muted, fontWeight: "600" }}>{items.length}</Text>
      </View>
      <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {items.map((item, i) => (
          <Pressable
            key={item._id}
            testID={`wishlist-item-${i}`}
            accessibilityRole="link"
            accessibilityLabel={`Open ${item.title}${item.price ? `, ${item.price}` : ""}`}
            onPress={() => Linking.openURL(productUrl(item))}
            style={({ pressed }) => [
              styles.row,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            {item.thumbUrl ? (
              <Image source={{ uri: item.thumbUrl }} style={styles.thumb} contentFit="cover" contentPosition="top" />
            ) : (
              <View style={[styles.thumb, styles.placeholder, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name={meta.icon as any} size={18} color={meta.color} />
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>
                {[item.price, item.url ? item.url.replace(/^https?:\/\/(www\.)?/i, "").split("/")[0] : "Search the web"].filter(Boolean).join(" · ")}
              </Text>
            </View>
            <Ionicons name="open-outline" size={18} color={meta.color} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20 },
  title: { fontSize: 20, fontWeight: "800", flex: 1 },
  list: { marginHorizontal: 20, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  placeholder: { alignItems: "center", justifyContent: "center" },
  name: { fontSize: 15, fontWeight: "700" },
});

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { TypeChip } from "@/components/TypeChip";
import { formatWhen } from "@/lib/format";
import { typeMeta, usePalette } from "@/lib/theme";
import { InboxItem } from "@/lib/types";

export function keyDetail(item: Pick<InboxItem, "type" | "startsAt" | "remindAt" | "location" | "price" | "url">) {
  if ((item.type === "event" || item.type === "todo") && item.startsAt)
    return { icon: "time-outline", text: (item.type === "todo" ? "Due " : "") + formatWhen(item.startsAt) };
  if (item.location) return { icon: "location-outline", text: item.location.name };
  if (item.price) return { icon: "pricetag-outline", text: item.price };
  if (item.url) return { icon: "link-outline", text: item.url.replace(/^https?:\/\//, "") };
  return null;
}

export function ItemCard({ item, index, onAct }: { item: InboxItem; index: number; onAct?: () => void }) {
  const { colors } = usePalette();
  const meta = typeMeta[item.type];
  const detail = keyDetail(item);
  return (
    <View
      testID={`inbox-card-${index}`}
      accessibilityLabel={`${meta.label}: ${item.title}. ${item.summary}`}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.imageWrap, { backgroundColor: colors.surfaceAlt }]}>
        {item.thumbUrl ? (
          <Image source={{ uri: item.thumbUrl }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={200} />
        ) : (
          <Ionicons name={meta.icon as any} size={48} color={meta.color} />
        )}
        <View style={[styles.accentBar, { backgroundColor: meta.color }]} />
      </View>
      <View style={styles.body}>
        <TypeChip type={item.type} />
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.summary, { color: colors.muted }]} numberOfLines={2}>
          {item.summary}
        </Text>
        {detail ? (
          <View style={styles.detail}>
            <Ionicons name={detail.icon as any} size={16} color={meta.color} />
            <Text style={[styles.detailText, { color: colors.text }]} numberOfLines={1}>
              {detail.text}
            </Text>
          </View>
        ) : null}
        {onAct ? (
          <Button
            testID={index === 0 ? "btn-act" : undefined}
            label={meta.action}
            icon={meta.actionIcon}
            color={meta.color}
            onPress={onAct}
            style={{ marginTop: 6 }}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  imageWrap: { flex: 1, minHeight: 140, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  accentBar: { position: "absolute", left: 0, right: 0, bottom: 0, height: 4 },
  body: { padding: 18, gap: 8 },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.3 },
  summary: { fontSize: 15, lineHeight: 20 },
  detail: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailText: { fontSize: 15, fontWeight: "600", flexShrink: 1 },
});

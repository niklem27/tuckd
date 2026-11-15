import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { keyDetail } from "@/components/ItemCard";
import { typeMeta, usePalette } from "@/lib/theme";
import { InboxItem } from "@/lib/types";

export function ItemRow({ item, time, testID }: { item: InboxItem; time?: string; testID?: string }) {
  const { colors } = usePalette();
  const meta = typeMeta[item.type];
  const detail = keyDetail(item);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${meta.label}: ${item.title}${time ? ` at ${time}` : ""}`}
      onPress={() => router.push({ pathname: "/item/[id]", params: { id: item._id } })}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
    >
      {time ? (
        <View style={styles.time}>
          <Text style={[styles.timeText, { color: colors.text }]}>{time}</Text>
        </View>
      ) : null}
      <View style={[styles.stripe, { backgroundColor: meta.color }]} />
      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.sub, { color: colors.muted }]} numberOfLines={1}>
          {detail && !time ? detail.text : item.location?.name ?? item.summary}
        </Text>
      </View>
      {item.thumbUrl ? (
        <Image source={{ uri: item.thumbUrl }} style={styles.thumb} contentFit="cover" contentPosition="top" />
      ) : (
        <Ionicons name={meta.icon as any} size={20} color={meta.color} />
      )}
    </Pressable>
  );
}

export function ItemTile({ item, testID }: { item: InboxItem; testID?: string }) {
  const { colors } = usePalette();
  const meta = typeMeta[item.type];
  const detail = keyDetail(item);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${meta.label}: ${item.title}`}
      onPress={() => router.push({ pathname: "/item/[id]", params: { id: item._id } })}
      style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, borderColor: colors.border, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <View style={[styles.tileImage, { backgroundColor: meta.color + "18" }]}>
        {item.thumbUrl ? (
          <Image source={{ uri: item.thumbUrl }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
        ) : (
          <Ionicons name={meta.icon as any} size={30} color={meta.color} />
        )}
        {item.state === "done" ? (
          <View style={[styles.doneBadge, { backgroundColor: meta.color }]}>
            <Ionicons name="checkmark" size={12} color="#fff" />
          </View>
        ) : null}
      </View>
      <View style={{ padding: 10, gap: 2 }}>
        <Text style={[styles.tileTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        {detail ? (
          <Text style={[styles.sub, { color: colors.muted }]} numberOfLines={1}>
            {detail.text}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  time: { width: 66 },
  timeText: { fontSize: 15, fontWeight: "800" },
  stripe: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: "700" },
  sub: { fontSize: 13 },
  thumb: { width: 44, height: 44, borderRadius: 10 },
  tile: { width: 150, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  tileImage: { height: 120, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  tileTitle: { fontSize: 15, fontWeight: "700" },
  doneBadge: { position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});

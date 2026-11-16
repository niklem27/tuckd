import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Toast, ToastState } from "@/components/Toast";
import { TypeChip } from "@/components/TypeChip";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useItemActions, mapsUrl } from "@/lib/actions";
import { DAY, formatWhen } from "@/lib/format";
import { openExternal } from "@/lib/intro";
import { ITEM_TYPES, ItemType, typeMeta, usePalette } from "@/lib/theme";

export function ItemSheet({ itemId }: { itemId: Id<"items"> }) {
  const { colors } = usePalette();
  const item = useQuery(api.items.get, { itemId });
  const update = useMutation(api.items.update);
  const [toast, setToast] = useState<ToastState>(null);
  const actions = useItemActions((message, onUndo) => setToast({ id: Date.now(), message, onUndo }));
  const [editingTitle, setEditingTitle] = useState<string | null>(null);

  if (item === undefined) return <ActivityIndicator style={{ marginTop: 60 }} />;
  if (item === null)
    return (
      <View style={styles.missing}>
        <Text style={{ color: colors.muted, fontSize: 16 }}>This item no longer exists.</Text>
      </View>
    );

  const meta = typeMeta[item.type];
  const image = item.imageUrl ?? item.thumbUrl;

  const shiftDate = (days: number) => {
    const base = item.startsAt ?? Date.now();
    const startsAt = base + days * DAY;
    update({ itemId, startsAt, ...(item.type === "todo" ? { remindAt: startsAt - DAY } : {}) });
  };

  const fields: [string, string, string][] = [];
  if (item.startsAt) fields.push(["time-outline", item.type === "todo" ? "Deadline" : "When", formatWhen(item.startsAt)]);
  if (item.remindAt) fields.push(["alarm-outline", "Reminder", formatWhen(item.remindAt)]);
  if (item.location) fields.push(["location-outline", "Place", [item.location.name, item.location.address].filter(Boolean).join(" · ")]);
  if (item.price) fields.push(["pricetag-outline", "Price", item.price]);
  if (item.url) fields.push(["link-outline", "Link", item.url]);
  fields.push(["sparkles-outline", "Confidence", `${Math.round(item.confidence * 100)}%`]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.content} testID="item-sheet">
        {image ? (
          <View style={[styles.imageWrap, { backgroundColor: colors.surfaceAlt }]}>
            <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="contain" />
          </View>
        ) : null}
        <TypeChip type={item.type} />
        {editingTitle !== null ? (
          <TextInput
            testID="input-title"
            accessibilityLabel="Title"
            value={editingTitle}
            onChangeText={setEditingTitle}
            autoFocus
            onSubmitEditing={() => {
              update({ itemId, title: editingTitle });
              setEditingTitle(null);
            }}
            onBlur={() => setEditingTitle(null)}
            style={[styles.title, styles.input, { color: colors.text, borderColor: colors.border }]}
          />
        ) : (
          <Pressable testID="btn-edit-title" accessibilityLabel="Edit title" onPress={() => setEditingTitle(item.title)} style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
            <Ionicons name="pencil" size={16} color={colors.muted} />
          </Pressable>
        )}
        <Text style={[styles.summary, { color: colors.muted }]}>{item.summary}</Text>

        <View style={[styles.fields, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {fields.map(([icon, label, value]) => (
            <Pressable
              key={label}
              testID={`field-${label.toLowerCase()}`}
              accessibilityLabel={`${label}: ${value}`}
              style={styles.field}
              disabled={label !== "Link" && label !== "Place"}
              onPress={() => {
                if (label === "Link" && item.url) openExternal(/^https?:/.test(item.url) ? item.url : `https://${item.url}`);
                if (label === "Place" && item.location) openExternal(mapsUrl(item.location));
              }}
            >
              <Ionicons name={icon as any} size={18} color={meta.color} />
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
              <Text style={[styles.fieldValue, { color: colors.text }]} numberOfLines={2}>
                {value}
              </Text>
            </Pressable>
          ))}
        </View>

        {item.startsAt || item.type === "event" || item.type === "todo" ? (
          <View style={styles.row}>
            <Button label="−1 day" variant="secondary" onPress={() => shiftDate(-1)} testID="btn-date-minus" style={{ flex: 1 }} />
            <Button label="+1 day" variant="secondary" onPress={() => shiftDate(1)} testID="btn-date-plus" style={{ flex: 1 }} />
          </View>
        ) : null}

        <Text style={[styles.section, { color: colors.muted }]}>Type</Text>
        <View style={styles.types}>
          {ITEM_TYPES.map((t: ItemType) => (
            <Pressable
              key={t}
              testID={`btn-type-${t}`}
              accessibilityLabel={`Change type to ${typeMeta[t].label}`}
              onPress={() => update({ itemId, type: t })}
              style={[
                styles.typeOption,
                { borderColor: t === item.type ? typeMeta[t].color : colors.border, backgroundColor: t === item.type ? typeMeta[t].color + "18" : colors.surface },
              ]}
            >
              <Ionicons name={typeMeta[t].icon as any} size={14} color={typeMeta[t].color} />
              <Text style={{ color: colors.text, fontWeight: "600" }}>{typeMeta[t].label}</Text>
            </Pressable>
          ))}
        </View>

        <Button label={meta.action} icon={meta.actionIcon} testID="btn-sheet-act" onPress={() => actions.act(item)} style={{ marginTop: 8 }} />
        <Button
          label="Delete"
          variant="danger"
          icon="trash-outline"
          testID="btn-sheet-archive"
          onPress={() =>
            Alert.alert("Delete this card?", undefined, [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => actions.archive(item).then(() => router.back()) },
            ])
          }
        />
      </ScrollView>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12, paddingBottom: 80 },
  missing: { flex: 1, alignItems: "center", justifyContent: "center" },
  imageWrap: { height: 320, borderRadius: 16, overflow: "hidden" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.3, flexShrink: 1 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  summary: { fontSize: 16, lineHeight: 22 },
  fields: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 4 },
  field: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  fieldLabel: { width: 84, fontSize: 14 },
  fieldValue: { flex: 1, fontSize: 15, fontWeight: "600" },
  row: { flexDirection: "row", gap: 10 },
  section: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 6 },
  types: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeOption: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5 },
});

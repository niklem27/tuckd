import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { chipColors, ItemType, typeMeta, usePalette } from "@/lib/theme";

export function TypeChip({ type, small }: { type: ItemType; small?: boolean }) {
  const { dark } = usePalette();
  const meta = typeMeta[type];
  const chip = chipColors(type, dark);
  return (
    <View style={[styles.chip, { backgroundColor: chip.background }, small && styles.small]} accessibilityLabel={`${meta.label} card`}>
      <Ionicons name={meta.icon as any} size={small ? 11 : 13} color={chip.text} />
      <Text style={[styles.label, { color: chip.text }, small && styles.smallLabel]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  small: { paddingHorizontal: 7, paddingVertical: 3, gap: 3 },
  label: { fontSize: 13, fontWeight: "700", letterSpacing: 0.2 },
  smallLabel: { fontSize: 11 },
});

import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { ItemType, typeMeta } from "@/lib/theme";

export function TypeChip({ type, small }: { type: ItemType; small?: boolean }) {
  const meta = typeMeta[type];
  return (
    <View
      style={[styles.chip, { backgroundColor: meta.color + "1F" }, small && styles.small]}
      accessibilityLabel={`${meta.label} card`}
    >
      <Ionicons name={meta.icon as any} size={small ? 11 : 13} color={meta.color} />
      <Text style={[styles.label, { color: meta.color }, small && styles.smallLabel]}>{meta.label}</Text>
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

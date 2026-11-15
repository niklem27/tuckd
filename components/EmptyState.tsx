import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { usePalette } from "@/lib/theme";

export function EmptyState({
  icon,
  title,
  body,
  children,
  testID,
}: {
  icon: string;
  title: string;
  body?: string;
  children?: ReactNode;
  testID?: string;
}) {
  const { colors } = usePalette();
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={[styles.icon, { backgroundColor: colors.accent + "18" }]}>
        <Ionicons name={icon as any} size={34} color={colors.accent} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {body ? <Text style={[styles.body, { color: colors.muted }]}>{body}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingVertical: 40, gap: 12 },
  icon: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  body: { fontSize: 15, lineHeight: 21, textAlign: "center" },
});

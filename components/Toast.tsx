import { StyleSheet, Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { usePalette } from "@/lib/theme";

export type ToastState = { id: number; message: string; onUndo?: () => void } | null;

export function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  const { colors, dark } = usePalette();
  if (!toast) return null;
  return (
    <Animated.View key={toast.id} entering={FadeInDown.springify()} exiting={FadeOutDown} style={styles.wrap} pointerEvents="box-none">
      <View
        testID="toast"
        accessibilityLiveRegion="polite"
        style={[styles.toast, { backgroundColor: dark ? colors.surfaceAlt : "#1C1C22" }]}
      >
        <Text style={styles.text} numberOfLines={2} testID="toast-message">
          {toast.message}
        </Text>
        {toast.onUndo ? (
          <Pressable
            testID="btn-undo"
            accessibilityRole="button"
            accessibilityLabel="Undo"
            hitSlop={10}
            onPress={() => {
              toast.onUndo?.();
              onDismiss();
            }}
          >
            <Text style={[styles.undo, { color: colors.accent === "#7C3AED" ? "#C4B5FD" : colors.accent }]}>Undo</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, bottom: 16 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  text: { flex: 1, color: "#fff", fontSize: 15, fontWeight: "600" },
  undo: { fontSize: 15, fontWeight: "800" },
});

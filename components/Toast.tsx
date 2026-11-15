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
        style={[styles.toast, { backgroundColor: dark ? colors.surfaceAlt : colors.text, borderColor: dark ? colors.border : colors.text }]}
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
            <Text style={[styles.undo, { color: dark ? colors.text : colors.background }]}>Undo</Text>
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
    borderWidth: 1,
  },
  text: { flex: 1, color: "#FBF6EE", fontSize: 15, fontWeight: "600" },
  undo: { fontSize: 15, fontWeight: "800", textDecorationLine: "underline" },
});

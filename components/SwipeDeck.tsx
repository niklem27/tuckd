import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { ItemCard } from "@/components/ItemCard";
import { usePalette } from "@/lib/theme";
import { InboxItem } from "@/lib/types";

export type SwipeDirection = "right" | "left" | "up";

const SPRING = { damping: 18, stiffness: 180, mass: 0.8 };

function TopCard({
  item,
  onSwiped,
  onAct,
}: {
  item: InboxItem;
  onSwiped: (dir: SwipeDirection) => void;
  onAct: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const { colors } = usePalette();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const thresholdX = width * 0.28;
  const thresholdY = height * 0.16;

  const fling = (dir: SwipeDirection) => {
    "worklet";
    const toX = dir === "right" ? width * 1.5 : dir === "left" ? -width * 1.5 : 0;
    const toY = dir === "up" ? -height : y.value;
    x.value = withTiming(toX, { duration: 220 });
    y.value = withTiming(toY, { duration: 220 }, (finished) => {
      if (finished) scheduleOnRN(onSwiped, dir);
    });
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      x.value = e.translationX;
      y.value = e.translationY;
    })
    .onEnd((e) => {
      const fastX = Math.abs(e.velocityX) > 900;
      if (x.value > thresholdX || (fastX && e.velocityX > 0 && x.value > 40)) fling("right");
      else if (x.value < -thresholdX || (fastX && e.velocityX < 0 && x.value < -40)) fling("left");
      else if (y.value < -thresholdY || (e.velocityY < -1000 && y.value < -40)) fling("up");
      else {
        x.value = withSpring(0, SPRING);
        y.value = withSpring(0, SPRING);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${interpolate(x.value, [-width, 0, width], [-14, 0, 14])}deg` },
    ],
  }));
  const keepStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [20, thresholdX], [0, 1], Extrapolation.CLAMP),
  }));
  const archiveStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-thresholdX, -20], [1, 0], Extrapolation.CLAMP),
  }));
  const actStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [-thresholdY, -20], [1, 0], Extrapolation.CLAMP) * (Math.abs(x.value) < 60 ? 1 : 0),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[StyleSheet.absoluteFill, cardStyle]}>
        <ItemCard item={item} index={0} onAct={onAct} />
        <Animated.View pointerEvents="none" style={[styles.overlay, { backgroundColor: colors.keep + "33" }, keepStyle]}>
          <Text style={[styles.stamp, { color: colors.keep, borderColor: colors.keep, transform: [{ rotate: "-12deg" }] }]}>KEEP</Text>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.overlay, { backgroundColor: colors.archive + "33" }, archiveStyle]}>
          <Text style={[styles.stamp, { color: colors.archive, borderColor: colors.archive, transform: [{ rotate: "12deg" }] }]}>ARCHIVE</Text>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.overlay, { backgroundColor: colors.accent + "33" }, actStyle]}>
          <Text style={[styles.stamp, { color: colors.accent, borderColor: colors.accent }]}>ACT NOW</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

export function SwipeDeck({
  items,
  onSwipe,
}: {
  items: InboxItem[];
  onSwipe: (item: InboxItem, dir: SwipeDirection) => Promise<boolean>;
}) {
  const { colors } = usePalette();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = items.filter((i) => !hidden.has(i._id));
  const top = visible[0];
  const next = visible[1];
  const scale = useSharedValue(0.94);

  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    const ids = new Set(items.map((i) => i._id as string));
    const stillPresent = [...hidden].filter((id) => ids.has(id));
    if (stillPresent.length !== hidden.size) setHidden(new Set(stillPresent));
  }

  useEffect(() => {
    scale.value = 0.94;
    scale.value = withSpring(1, SPRING);
  }, [top?._id, scale]);

  const nextStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.94 }, { translateY: 14 }] }));
  const topEnter = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const commit = (item: InboxItem, dir: SwipeDirection) => {
    Haptics.impactAsync(dir === "up" ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setHidden((prev) => new Set(prev).add(item._id));
    onSwipe(item, dir).then((ok) => {
      if (ok) return;
      setHidden((prev) => {
        const next = new Set(prev);
        next.delete(item._id);
        return next;
      });
    });
  };

  if (!top) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.stack}>
        {next ? (
          <Animated.View style={[StyleSheet.absoluteFill, nextStyle]} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <ItemCard item={next} index={1} />
          </Animated.View>
        ) : null}
        <Animated.View key={top._id} style={[StyleSheet.absoluteFill, topEnter]}>
          <TopCard item={top} onSwiped={(dir) => commit(top, dir)} onAct={() => commit(top, "up")} />
        </Animated.View>
      </View>
      <View style={styles.controls}>
        <RoundButton testID="btn-archive" label="Archive" icon="close" color={colors.archive} onPress={() => commit(top, "left")} />
        <RoundButton testID="btn-act-now" label="Act now" icon="flash" color={colors.accent} small onPress={() => commit(top, "up")} />
        <RoundButton testID="btn-keep" label="Keep" icon="heart" color={colors.keep} onPress={() => commit(top, "right")} />
      </View>
    </View>
  );
}

function RoundButton({
  testID,
  label,
  icon,
  color,
  small,
  onPress,
}: {
  testID: string;
  label: string;
  icon: string;
  color: string;
  small?: boolean;
  onPress: () => void;
}) {
  const { colors } = usePalette();
  const size = small ? 52 : 64;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.round,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface, borderColor: color + "55", transform: [{ scale: pressed ? 0.9 : 1 }] },
      ]}
    >
      <Ionicons name={icon as any} size={small ? 22 : 28} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 20 },
  stack: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  stamp: { fontSize: 38, fontWeight: "900", letterSpacing: 3, borderWidth: 4, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 6 },
  controls: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 28, paddingVertical: 18 },
  round: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});

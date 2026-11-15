import { useConvexAuth, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "@/components/EmptyState";
import { ItemRow } from "@/components/ItemRow";
import { NearbyCard } from "@/components/NearbyCard";
import { api } from "@/convex/_generated/api";
import { DAY, formatDay, formatTime, greeting, startOfDay } from "@/lib/format";
import { usePalette } from "@/lib/theme";
import { InboxItem } from "@/lib/types";

function whenOf(item: InboxItem, from: number, to: number) {
  if (item.startsAt && item.startsAt >= from && item.startsAt < to) return item.startsAt;
  return item.remindAt ?? item.startsAt ?? 0;
}

export default function TodayScreen() {
  const { colors } = usePalette();
  const { isAuthenticated } = useConvexAuth();
  const [anchor, setAnchor] = useState(() => startOfDay());
  const range = useMemo(() => ({ today: { from: anchor, to: anchor + DAY }, upcoming: { from: anchor + DAY, to: anchor + 8 * DAY } }), [anchor]);
  const today = useQuery(api.items.today, isAuthenticated ? range.today : "skip");
  const upcoming = useQuery(api.items.upcoming, isAuthenticated ? range.upcoming : "skip");
  const loading = today === undefined || upcoming === undefined;
  const count = today?.length ?? 0;
  const headline =
    count > 0 ? `${count} thing${count === 1 ? "" : "s"} you saved matter${count === 1 ? "s" : ""} today.` : "Nothing you saved is due today.";

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => setAnchor(startOfDay())} tintColor={colors.accent} />}
      >
        <View style={styles.header}>
          <Text style={[styles.date, { color: colors.muted }]}>
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </Text>
          <Text style={[styles.h1, { color: colors.text }]} testID="today-greeting">
            {greeting()} — {headline}
          </Text>
        </View>
        <NearbyCard />
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
        ) : (
          <>
            <Text style={[styles.section, { color: colors.muted }]}>Today</Text>
            <View testID="today-section">
              {today.length === 0 ? (
                <Text style={[styles.empty, { color: colors.muted }]}>Clear day. Events and deadlines you save show up here.</Text>
              ) : (
                today.map((item, i) => (
                  <ItemRow key={item._id} item={item} time={formatTime(whenOf(item, range.today.from, range.today.to))} testID={`today-item-${i}`} />
                ))
              )}
            </View>
            <Text style={[styles.section, { color: colors.muted }]}>Coming up</Text>
            <View testID="upcoming-section">
              {upcoming.length === 0 ? (
                today.length === 0 ? (
                  <EmptyState icon="sunny-outline" title="Your week is open" body="Keep event and to-do cards in the Inbox to plan ahead." />
                ) : (
                  <Text style={[styles.empty, { color: colors.muted }]}>Nothing in the next 7 days.</Text>
                )
              ) : (
                upcoming.map((item, i) => {
                  const at = whenOf(item, range.upcoming.from, range.upcoming.to);
                  return <ItemRow key={item._id} item={item} time={formatDay(at).replace(/,.*$/, "")} testID={`upcoming-item-${i}`} />;
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 4 },
  date: { fontSize: 14, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  h1: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5, lineHeight: 34 },
  section: { fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginHorizontal: 20, marginTop: 14, marginBottom: 10 },
  empty: { marginHorizontal: 20, fontSize: 15, marginBottom: 8 },
});

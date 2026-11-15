import { useConvexAuth, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { useIngestContext } from "@/components/IngestProvider";
import { SwipeDeck, SwipeDirection } from "@/components/SwipeDeck";
import { SyncBanner } from "@/components/SyncBanner";
import { Toast, ToastState } from "@/components/Toast";
import { api } from "@/convex/_generated/api";
import { useItemActions } from "@/lib/actions";
import { isDemoMode, usePalette } from "@/lib/theme";
import { InboxItem } from "@/lib/types";

const TOAST_MS = 6000;

export default function InboxScreen() {
  const { colors } = usePalette();
  const { isAuthenticated } = useConvexAuth();
  const items = useQuery(api.items.inbox, isAuthenticated ? {} : "skip");
  const status = useQuery(api.screenshots.syncStatus, isAuthenticated ? {} : "skip");
  const stats = useQuery(api.items.stats, isAuthenticated ? {} : "skip");
  const { sync, loadDemo, uploading, error } = useIngestContext();
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string, onUndo?: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, onUndo });
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const actions = useItemActions(notify);

  const onSwipe = async (item: InboxItem, dir: SwipeDirection) => {
    try {
      if (dir === "right") await actions.keep(item);
      else if (dir === "left") await actions.archive(item);
      else return await actions.act(item);
      return true;
    } catch {
      return false;
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await sync().finally(() => setRefreshing(false));
  };

  const sorting = status?.sorting ?? 0;
  const left = items?.length ?? 0;
  const progress = [`${left} left`, sorting > 0 ? `${sorting} sorting…` : null].filter(Boolean).join(" · ");
  const failed = status?.failed ?? 0;

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.h1, { color: colors.text }]}>Inbox</Text>
        {items && (left > 0 || sorting > 0) ? (
          <Text testID="inbox-progress" style={[styles.progress, { color: colors.muted }]}>
            {progress}
          </Text>
        ) : null}
      </View>
      <SyncBanner />
      {error ? <Text style={[styles.error, { color: colors.archive }]}>{error}</Text> : null}
      {failed > 0 ? (
        <Text style={[styles.error, { color: colors.muted }]} testID="failed-note">
          {failed} screenshot{failed === 1 ? "" : "s"} couldn’t be read. Retry from Settings.
        </Text>
      ) : null}

      {items === undefined ? (
        <ActivityIndicator style={{ marginTop: 80 }} color={colors.accent} />
      ) : left > 0 ? (
        <SwipeDeck items={items} onSwipe={onSwipe} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.emptyWrap}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >
          {sorting > 0 || uploading ? (
            <EmptyState icon="sparkles" title="Sorting your screenshots…" body="Cards appear here as soon as each one is read." testID="inbox-sorting" />
          ) : (status?.total ?? 0) > 0 ? (
            <EmptyState
              icon="checkmark-done"
              title="All caught up"
              body={`You cleared ${stats?.clearedThisWeek ?? 0} screenshot${stats?.clearedThisWeek === 1 ? "" : "s"} this week.`}
              testID="inbox-zero"
            >
              {isDemoMode ? <Button label="Load demo screenshots" variant="secondary" icon="images-outline" onPress={loadDemo} testID="btn-load-demo" /> : null}
            </EmptyState>
          ) : (
            <EmptyState icon="images-outline" title="No screenshots yet" body="Take a screenshot of a flyer, a place or a recipe, then pull down to refresh." testID="inbox-empty">
              {isDemoMode ? (
                <Button label="Load demo screenshots" icon="images-outline" onPress={loadDemo} testID="btn-load-demo" loading={!!uploading} />
              ) : null}
            </EmptyState>
          )}
        </ScrollView>
      )}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  h1: { fontSize: 34, fontWeight: "800", letterSpacing: -0.8 },
  progress: { fontSize: 15, fontWeight: "600" },
  error: { marginHorizontal: 20, marginBottom: 8, fontSize: 14 },
  emptyWrap: { flexGrow: 1, justifyContent: "center" },
});

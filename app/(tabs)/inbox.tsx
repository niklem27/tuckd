import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { useIngestContext } from "@/components/IngestProvider";
import { SwipeDeck, SwipeDirection } from "@/components/SwipeDeck";
import { SyncBanner } from "@/components/SyncBanner";
import { Toast, ToastState } from "@/components/Toast";
import { api } from "@/convex/_generated/api";
import { useItemActions } from "@/lib/actions";
import { showIntro } from "@/lib/intro";
import { deleteOriginals } from "@/lib/originals";
import { isDemoMode, usePalette } from "@/lib/theme";
import { InboxItem } from "@/lib/types";

const TOAST_MS = 5000;

export default function InboxScreen() {
  const { colors } = usePalette();
  const { isAuthenticated } = useConvexAuth();
  const items = useQuery(api.items.inbox, isAuthenticated ? {} : "skip");
  const status = useQuery(api.screenshots.syncStatus, isAuthenticated ? {} : "skip");
  const stats = useQuery(api.items.stats, isAuthenticated ? {} : "skip");
  const marked = useQuery(api.screenshots.deletableOriginals, isAuthenticated ? { scope: "deleted" } : "skip");
  const markDeleted = useMutation(api.screenshots.markOriginalsDeleted);
  const [deleting, setDeleting] = useState(false);
  const sawCards = useRef(false);
  const { sync, loadDemo, uploading, error } = useIngestContext();
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [lastUndo, setLastUndo] = useState<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string, onUndo?: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    const undoOnce = onUndo
      ? () => {
          onUndo();
          setLastUndo(null);
        }
      : undefined;
    setToast({ id: Date.now(), message, onUndo: undoOnce });
    setLastUndo(() => undoOnce ?? null);
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
  const markedCount = marked?.length ?? 0;

  const deleteMarked = useCallback(async () => {
    if (!marked?.length) return;
    setDeleting(true);
    try {
      const n = await deleteOriginals(marked, markDeleted);
      if (n > 0) notify(`Deleted ${n} photo${n === 1 ? "" : "s"} from your phone`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Couldn't delete the photos");
    } finally {
      setDeleting(false);
    }
  }, [marked, markDeleted, notify]);

  useEffect(() => {
    if (items === undefined || marked === undefined) return;
    if (left > 0) {
      sawCards.current = true;
      return;
    }
    if (!sawCards.current || markedCount === 0) return;
    sawCards.current = false;
    deleteMarked();
  }, [items, marked, left, markedCount, deleteMarked]);
  const progress = [`${left} left`, sorting > 0 ? `${sorting} sorting…` : null].filter(Boolean).join(" · ");
  const failed = status?.failed ?? 0;

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.h1, { color: colors.text }]}>Inbox</Text>
          {isDemoMode ? (
            <Pressable
              testID="btn-show-intro"
              accessibilityRole="button"
              accessibilityLabel="Show the intro"
              hitSlop={8}
              onPress={showIntro}
              style={[styles.introPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Ionicons name="play-circle-outline" size={14} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>Intro</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.headerRight}>
          {items && (left > 0 || sorting > 0) ? (
            <Text testID="inbox-progress" style={[styles.progress, { color: colors.muted }]}>
              {progress}
            </Text>
          ) : null}
          {markedCount > 0 ? (
            <View
              testID="pending-deletes"
              accessibilityLabel={`${markedCount} photo${markedCount === 1 ? "" : "s"} marked for deletion`}
              style={[styles.undoPill, { backgroundColor: colors.archive + "26" }]}
            >
              <Ionicons name="trash-outline" size={14} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{markedCount}</Text>
            </View>
          ) : null}
          {lastUndo ? (
            <Pressable
              testID="btn-undo-last"
              accessibilityRole="button"
              accessibilityLabel="Undo last swipe"
              hitSlop={8}
              onPress={() => {
                lastUndo();
                setToast(null);
              }}
              style={[styles.undoPill, { backgroundColor: colors.accent + "18" }]}
            >
              <Ionicons name="arrow-undo" size={14} color={colors.accent} />
              <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 14 }}>Undo</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <SyncBanner />
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
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
          {markedCount > 0 ? (
            <EmptyState
              icon="trash-outline"
              title={`${markedCount} photo${markedCount === 1 ? "" : "s"} marked for deletion`}
              body="You deleted these cards. Remove the originals from your phone in one go."
              testID="inbox-delete-marked"
            >
              <Button
                label={`Delete ${markedCount} photo${markedCount === 1 ? "" : "s"}`}
                icon="trash-outline"
                onPress={deleteMarked}
                loading={deleting}
                testID="btn-delete-marked"
              />
            </EmptyState>
          ) : sorting > 0 || uploading ? (
            <EmptyState icon="sparkles" title="Sorting your screenshots…" body="Cards appear here as soon as each one is read." testID="inbox-sorting" />
          ) : (status?.total ?? 0) > 0 ? (
            <EmptyState
              icon="checkmark-done"
              title={`All caught up — you cleared ${stats?.clearedThisWeek ?? 0} screenshot${stats?.clearedThisWeek === 1 ? "" : "s"}`}
              body="New screenshots show up here as soon as they're sorted."
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
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  introPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  undoPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  error: { marginHorizontal: 20, marginBottom: 8, fontSize: 14 },
  emptyWrap: { flexGrow: 1, justifyContent: "center" },
});

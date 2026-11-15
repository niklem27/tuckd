import { useConvexAuth, useMutation, useQuery } from "convex/react";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { ReactNode, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { useIngestContext } from "@/components/IngestProvider";
import { api } from "@/convex/_generated/api";
import { deleteOriginals } from "@/lib/originals";
import { DAY, formatBytes, startOfDay } from "@/lib/format";
import { getPushToken, previewMorningBrief, requestNotificationPermission } from "@/lib/notifications";
import { isDemoMode, usePalette } from "@/lib/theme";

const AGENT_URL = process.env.EXPO_PUBLIC_SNAPBACK_AGENT_URL;

export default function SettingsScreen() {
  const { colors } = usePalette();
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.profile.me, isAuthenticated ? {} : "skip");
  const stats = useQuery(api.items.stats, isAuthenticated ? {} : "skip");
  const status = useQuery(api.screenshots.syncStatus, isAuthenticated ? {} : "skip");
  const from = startOfDay();
  const today = useQuery(api.items.today, isAuthenticated ? { from, to: from + DAY } : "skip");
  const upsert = useMutation(api.profile.upsert);
  const savePushToken = useMutation(api.notifications.savePushToken);
  const deleteAll = useMutation(api.profile.deleteAllData);
  const retryFailed = useMutation(api.screenshots.retryFailed);
  const linkCode = useMutation(api.agent.linkCode);
  const { sync, loadDemo, uploading } = useIngestContext();
  const [syncing, setSyncing] = useState(false);
  const [freeing, setFreeing] = useState(false);
  const briefEnabled = me?.profile?.briefEnabled ?? false;
  const deleteOriginalsOn = me?.profile?.deleteOriginals ?? false;
  const sorted = useQuery(api.screenshots.deletableOriginals, isAuthenticated ? { scope: "sorted" } : "skip");
  const markDeleted = useMutation(api.screenshots.markOriginalsDeleted);

  const freeSpace = async () => {
    if (!sorted?.length) return;
    setFreeing(true);
    try {
      const n = await deleteOriginals(sorted, markDeleted);
      if (n > 0) Alert.alert(`Deleted ${n} original${n === 1 ? "" : "s"}`, "Your cards stay here. iOS keeps them in Recently Deleted for 30 days.");
    } catch (err) {
      Alert.alert("Couldn't delete originals", err instanceof Error ? err.message : String(err));
    } finally {
      setFreeing(false);
    }
  };

  const toggleBrief = async (next: boolean) => {
    if (next) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert("Notifications are off", "Turn on notifications for Tuckd in Settings to get the morning brief.");
        return;
      }
      const token = await getPushToken();
      if (token) await savePushToken({ token });
    }
    await upsert({ briefEnabled: next });
  };

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.h1, { color: colors.text }]}>Settings</Text>

        <View style={[styles.stats, { backgroundColor: colors.accent }]} testID="stats-card">
          <Stat label="Screenshots sorted" value={String(stats?.sorted ?? 0)} />
          <Stat label="Space you could free" value={formatBytes(stats?.estimatedFreeableBytes ?? 0)} />
          <Stat label="Cleared this week" value={String(stats?.clearedThisWeek ?? 0)} />
        </View>

        <Group title="Screenshots">
          <Button
            label="Re-sync now"
            icon="refresh"
            variant="secondary"
            testID="btn-resync"
            loading={syncing}
            onPress={async () => {
              setSyncing(true);
              const n = await sync().finally(() => setSyncing(false));
              Alert.alert(n > 0 ? `Importing ${n} new screenshot${n === 1 ? "" : "s"}` : "You're up to date");
            }}
          />
          {(status?.failed ?? 0) > 0 ? (
            <Button label={`Retry ${status!.failed} failed`} icon="reload" variant="secondary" testID="btn-retry-failed" onPress={() => retryFailed()} />
          ) : null}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Delete originals after sorting</Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>Once you act on or archive a card, its screenshot or photo is removed from your phone</Text>
            </View>
            <Switch
              testID="toggle-delete-originals"
              accessibilityLabel="Delete originals after sorting"
              value={deleteOriginalsOn}
              onValueChange={(next) => {
                upsert({ deleteOriginals: next });
              }}
              trackColor={{ true: colors.accent }}
            />
          </View>
          {sorted?.length ? (
            <Button
              label={`Free up space (${sorted.length} original${sorted.length === 1 ? "" : "s"})`}
              icon="trash-bin-outline"
              variant="secondary"
              testID="btn-free-space"
              loading={freeing}
              onPress={freeSpace}
            />
          ) : null}
          {isDemoMode ? (
            <Button label="Load demo screenshots" icon="images-outline" variant="secondary" testID="btn-load-demo" loading={!!uploading} onPress={loadDemo} />
          ) : null}
        </Group>

        {AGENT_URL ? (
          <Group title="Text Tuckd">
            <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
              Send screenshots to the Tuckd bot on Telegram and they land here, sorted. It can also text you the morning brief.
            </Text>
            <Button
              label="Text Tuckd"
              icon="chatbubble-ellipses-outline"
              variant="secondary"
              testID="btn-text-snapback"
              onPress={async () => {
                const code = await linkCode();
                await Linking.openURL(`${AGENT_URL}?start=${code}`);
              }}
            />
          </Group>
        ) : null}

        <Group title="Notifications">
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Morning brief</Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>7:00am, only when something matters today</Text>
            </View>
            <Switch testID="toggle-brief" accessibilityLabel="Morning brief notifications" value={briefEnabled} onValueChange={toggleBrief} trackColor={{ true: colors.accent }} />
          </View>
          {isDemoMode ? (
            <Button
              label="Preview morning brief"
              icon="notifications-outline"
              variant="ghost"
              testID="btn-preview-brief"
              onPress={async () => {
                if (!(await requestNotificationPermission())) return;
                await previewMorningBrief(today?.length ?? 0, today?.[0]?.title);
              }}
            />
          ) : null}
        </Group>

        <Group title="Privacy">
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
            Full images are deleted after sorting unless you keep the card. Sensitive screenshots (banking, passwords, IDs) are skipped and deleted
            {stats?.skipped ? ` (${stats.skipped} so far)` : ""}.
          </Text>
          <Button
            label="Delete all my data"
            icon="trash-outline"
            variant="danger"
            testID="btn-delete-all"
            onPress={() =>
              Alert.alert("Delete everything?", "This removes every card and stored image. It can't be undone.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: async () => {
                    await deleteAll();
                    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
                  },
                },
              ])
            }
          />
        </Group>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800" }}>{value}</Text>
      <Text style={{ color: "#ffffffCC", fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = usePalette();
  return (
    <View style={{ gap: 10 }}>
      <Text style={[styles.groupTitle, { color: colors.muted }]}>{title}</Text>
      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, gap: 22, paddingBottom: 60 },
  h1: { fontSize: 34, fontWeight: "800", letterSpacing: -0.8 },
  stats: { flexDirection: "row", gap: 10, padding: 18, borderRadius: 20 },
  groupTitle: { fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  group: { padding: 14, gap: 10, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowTitle: { fontSize: 16, fontWeight: "700" },
});

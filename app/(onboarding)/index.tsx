import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInRight, FadeOutLeft } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { api } from "@/convex/_generated/api";
import { PhotoAccess, presentLimitedPicker, requestPhotoAccess } from "@/lib/ingest";
import { markIntroShown } from "@/lib/intro";
import { getPushToken, requestNotificationPermission } from "@/lib/notifications";
import { typeMeta, usePalette } from "@/lib/theme";

export default function Onboarding() {
  const { colors } = usePalette();
  const [step, setStep] = useState(0);
  const [access, setAccess] = useState<PhotoAccess | null>(null);
  const upsert = useMutation(api.profile.upsert);
  const savePushToken = useMutation(api.notifications.savePushToken);

  const finish = async () => {
    markIntroShown();
    await upsert({ onboarded: true, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    router.replace("/(tabs)/inbox");
  };

  const askPhotos = async () => {
    const result = await requestPhotoAccess();
    setAccess(result);
    if (result === "all") setStep(2);
  };

  const askNotifications = async () => {
    const granted = await requestNotificationPermission();
    await upsert({ briefEnabled: granted });
    if (granted) {
      const token = await getPushToken();
      if (token) await savePushToken({ token }).catch(() => {});
    }
    await finish();
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.top}>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i <= step ? colors.accent : colors.border, width: i === step ? 22 : 8 }]} />
          ))}
        </View>
        <Pressable testID="btn-skip" accessibilityRole="button" accessibilityLabel="Skip onboarding" onPress={finish} hitSlop={12}>
          <Text style={{ color: colors.muted, fontSize: 16, fontWeight: "600" }}>Skip</Text>
        </Pressable>
      </View>

      <Animated.View key={step} entering={FadeInRight.springify()} exiting={FadeOutLeft} style={styles.body}>
        {step === 0 ? (
          <>
            <View style={styles.collage}>
              {(["event", "place", "recipe", "todo", "product"] as const).map((t, i) => (
                <View
                  key={t}
                  style={[
                    styles.tile,
                    { backgroundColor: typeMeta[t].color, transform: [{ rotate: `${(i - 2) * 8}deg` }, { translateY: Math.abs(i - 2) * 10 }] },
                  ]}
                >
                  <Ionicons name={typeMeta[t].icon as any} size={26} color="#fff" />
                </View>
              ))}
            </View>
            <Text style={[styles.title, { color: colors.text }]}>You have hundreds of screenshots. Let’s make them useful.</Text>
            <Text style={[styles.copy, { color: colors.muted }]}>
              Tuckd reads new screenshots and turns flyers, places, recipes and deadlines into one-tap actions.
            </Text>
            <Text style={[styles.copy, { color: colors.accent, fontWeight: "700" }]}>Keep what matters, tuckd away.</Text>
          </>
        ) : step === 1 ? (
          <>
            <Hero icon="images" color={typeMeta.place.color} />
            <Text style={[styles.title, { color: colors.text }]}>Let Tuckd see your screenshots</Text>
            <Text style={[styles.copy, { color: colors.muted }]}>
              Only screenshots are read. Images are deleted after sorting unless you keep the card.
            </Text>
            {access === "limited" ? (
              <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="limited-access-note">
                <Text style={[styles.noteText, { color: colors.text }]}>
                  You gave access to selected photos only. Tuckd can sort just those. Add your Screenshots album for the full experience.
                </Text>
                <Button label="Select more photos" variant="secondary" onPress={() => presentLimitedPicker()} testID="btn-select-more" />
              </View>
            ) : null}
            {access === "denied" ? (
              <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="denied-access-note">
                <Text style={[styles.noteText, { color: colors.text }]}>
                  Photo access is off. Turn it on in Settings, or share a single screenshot to Tuckd from the Photos share sheet.
                </Text>
                <Button label="Open Settings" variant="secondary" icon="settings-outline" onPress={() => Linking.openSettings()} testID="btn-open-settings" />
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Hero icon="notifications" color={typeMeta.event.color} />
            <Text style={[styles.title, { color: colors.text }]}>Get your morning brief</Text>
            <Text style={[styles.copy, { color: colors.muted }]}>
              At 7am we’ll tell you which saved things matter today, plus a nudge before events and deadlines.
            </Text>
          </>
        )}
      </Animated.View>

      <View style={styles.footer}>
        {step === 0 ? (
          <Button label="Get started" onPress={() => setStep(1)} testID="btn-onboarding-next" />
        ) : step === 1 ? (
          access === null ? (
            <Button label="Allow photo access" icon="images-outline" onPress={askPhotos} testID="btn-allow-photos" />
          ) : (
            <Button label="Continue" onPress={() => setStep(2)} testID="btn-onboarding-next" />
          )
        ) : (
          <>
            <Button label="Turn on notifications" icon="notifications-outline" onPress={askNotifications} testID="btn-allow-notifications" />
            <Button label="Not now" variant="ghost" onPress={finish} testID="btn-notifications-later" />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function Hero({ icon, color }: { icon: string; color: string }) {
  return (
    <View style={[styles.hero, { backgroundColor: color + "1F" }]}>
      <Ionicons name={icon as any} size={56} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingTop: 8 },
  dots: { flexDirection: "row", gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  body: { flex: 1, justifyContent: "center", paddingHorizontal: 28, gap: 16 },
  collage: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 28 },
  tile: { width: 56, height: 76, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  hero: { width: 112, height: 112, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -0.6, lineHeight: 38 },
  copy: { fontSize: 17, lineHeight: 24 },
  note: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12, marginTop: 8 },
  noteText: { fontSize: 15, lineHeight: 21 },
  footer: { paddingHorizontal: 24, paddingBottom: 16, gap: 8 },
});

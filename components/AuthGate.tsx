import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { api } from "@/convex/_generated/api";
import { usePalette } from "@/lib/theme";

export function AuthGate({ children }: { children: ReactNode }) {
  const { colors } = usePalette();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const upsert = useMutation(api.profile.upsert);
  const me = useQuery(api.profile.me, isAuthenticated ? {} : "skip");
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  const trySignIn = () => {
    setError(null);
    signIn("anonymous").catch((err) => setError(err instanceof Error ? err.message : String(err)));
  };

  useEffect(() => {
    if (isLoading || isAuthenticated || attempted.current) return;
    attempted.current = true;
    trySignIn();
  });

  useEffect(() => {
    if (!isAuthenticated || me === undefined) return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (me === null) return;
    if (!me.profile || me.profile.timezone !== timezone) upsert({ timezone }).catch(() => {});
  }, [isAuthenticated, me, upsert]);

  if (isAuthenticated && me?.profile) return <>{children}</>;

  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      {error ? (
        <>
          <Text style={[styles.title, { color: colors.text }]}>Can’t reach Snapback</Text>
          <Text style={[styles.body, { color: colors.muted }]}>{error}</Text>
          <Button label="Try again" onPress={trySignIn} testID="btn-retry-auth" />
        </>
      ) : (
        <ActivityIndicator color={colors.accent} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  title: { fontSize: 20, fontWeight: "800" },
  body: { fontSize: 15, textAlign: "center" },
});

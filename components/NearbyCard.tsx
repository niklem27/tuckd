import { Ionicons } from "@expo/vector-icons";
import { useConvexAuth, useQuery } from "convex/react";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "@/convex/_generated/api";
import { typeMeta, usePalette } from "@/lib/theme";

const NUDGE_METERS = 300;

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function NearbyCard() {
  const { colors } = usePalette();
  const { isAuthenticated } = useConvexAuth();
  const places = useQuery(api.items.keptPlaces, isAuthenticated ? {} : "skip");
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const hasGeocoded = !!places?.some((p) => p.location?.lat !== undefined);

  useEffect(() => {
    if (!hasGeocoded) return;
    let cancelled = false;
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      const granted = perm.granted || (perm.canAskAgain && (await Location.requestForegroundPermissionsAsync()).granted);
      if (!granted || cancelled) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!cancelled) setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hasGeocoded]);

  if (!here || !places) return null;
  const nearest = places
    .filter((p) => p.location?.lat !== undefined && p.location?.lng !== undefined)
    .map((p) => ({ p, d: distanceMeters(here, { lat: p.location!.lat!, lng: p.location!.lng! }) }))
    .sort((a, b) => a.d - b.d)[0];
  if (!nearest || nearest.d > NUDGE_METERS) return null;
  const month = new Date(nearest.p.createdAt).toLocaleDateString(undefined, { month: "long" });
  const color = typeMeta.place.color;
  return (
    <View testID="nearby-card" style={[styles.card, { backgroundColor: color + "16", borderColor: color + "40" }]}>
      <Ionicons name="navigate" size={22} color={color} />
      <Text style={[styles.text, { color: colors.text }]}>
        You’re {Math.round(nearest.d / 10) * 10} m from <Text style={{ fontWeight: "800" }}>{nearest.p.location!.name}</Text> (you saved it in {month})
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 20, marginBottom: 8, padding: 14, borderRadius: 16, borderWidth: 1 },
  text: { flex: 1, fontSize: 15, lineHeight: 20 },
});

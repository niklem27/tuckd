import { Ionicons } from "@expo/vector-icons";
import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "@/components/EmptyState";
import { ItemRow, ItemTile } from "@/components/ItemRow";
import { WishlistSection } from "@/components/WishlistSection";
import { WrappedCard } from "@/components/WrappedCard";
import { api } from "@/convex/_generated/api";
import { ITEM_TYPES, typeMeta, usePalette } from "@/lib/theme";

export default function SavedScreen() {
  const { colors } = usePalette();
  const { isAuthenticated } = useConvexAuth();
  const saved = useQuery(api.items.saved, isAuthenticated ? {} : "skip");
  const wishlist = useQuery(api.items.wishlist, isAuthenticated ? {} : "skip");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);
  const results = useQuery(api.items.search, isAuthenticated && debounced ? { q: debounced } : "skip");

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[styles.h1, { color: colors.text }]}>Saved</Text>
      <View style={[styles.search, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          testID="saved-search"
          accessibilityLabel="Search saved items"
          placeholder="Search saved screenshots"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
          autoCorrect={false}
          style={[styles.input, { color: colors.text }]}
        />
      </View>
      {debounced ? (
        results === undefined ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={colors.accent} />
        ) : results.length === 0 ? (
          <EmptyState icon="search" title="No matches" body={`Nothing saved matches "${debounced}".`} />
        ) : (
          <FlatList data={results} keyExtractor={(i) => i._id} renderItem={({ item, index }) => <ItemRow item={item} testID={`search-result-${index}`} />} />
        )
      ) : saved === undefined ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : saved.length === 0 && !wishlist?.length ? (
        <EmptyState icon="bookmark-outline" title="Nothing saved yet" body="Swipe right on a card in the Inbox to tuck it here." testID="saved-empty" />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} testID="saved-list">
          <WrappedCard />
          <WishlistSection items={wishlist ?? []} />
          {ITEM_TYPES.filter((type) => type !== "product").map((type) => {
            const group = saved.filter((i) => i.type === type);
            if (group.length === 0) return null;
            const meta = typeMeta[type];
            return (
              <View key={type} style={{ marginTop: 18 }} testID={`saved-section-${type}`}>
                <View style={styles.sectionHeader}>
                  <Ionicons name={meta.icon as any} size={16} color={meta.color} />
                  <Text style={[styles.section, { color: colors.text }]}>{meta.plural}</Text>
                  <Text style={{ color: colors.muted, fontWeight: "600" }}>{group.length}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                  {group.map((item, i) => (
                    <ItemTile key={item._id} item={item} testID={`saved-${type}-${i}`} />
                  ))}
                </ScrollView>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  h1: { fontSize: 34, fontWeight: "800", letterSpacing: -0.8, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, paddingHorizontal: 12, borderRadius: 12, height: 42 },
  input: { flex: 1, fontSize: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, marginBottom: 10 },
  section: { fontSize: 20, fontWeight: "800", flex: 1 },
  rail: { paddingHorizontal: 20, gap: 12 },
});

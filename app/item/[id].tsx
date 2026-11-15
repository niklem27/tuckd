import { useLocalSearchParams } from "expo-router";
import { ItemSheet } from "@/components/ItemSheet";
import { Id } from "@/convex/_generated/dataModel";

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ItemSheet itemId={id as Id<"items">} />;
}

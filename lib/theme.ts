import { useColorScheme } from "react-native";

export type ItemType = "event" | "place" | "product" | "recipe" | "todo" | "memory";

export const typeMeta: Record<
  ItemType,
  { label: string; plural: string; color: string; icon: string; action: string; actionIcon: string }
> = {
  event: { label: "Event", plural: "Events", color: "#7C3AED", icon: "calendar", action: "Add to calendar", actionIcon: "calendar-outline" },
  place: { label: "Place", plural: "Places", color: "#F97316", icon: "location", action: "Open in Maps", actionIcon: "map-outline" },
  product: { label: "Product", plural: "Products", color: "#2563EB", icon: "pricetag", action: "Open link", actionIcon: "open-outline" },
  recipe: { label: "Recipe", plural: "Recipes", color: "#16A34A", icon: "restaurant", action: "Save recipe", actionIcon: "bookmark-outline" },
  todo: { label: "To-do", plural: "To-dos", color: "#DC2626", icon: "checkbox", action: "Set reminder", actionIcon: "alarm-outline" },
  memory: { label: "Memory", plural: "Memories", color: "#6B7280", icon: "sparkles", action: "Tuck", actionIcon: "heart-outline" },
};

export const ITEM_TYPES = Object.keys(typeMeta) as ItemType[];

const light = {
  background: "#F7F7F9",
  surface: "#FFFFFF",
  surfaceAlt: "#F0F0F4",
  text: "#111114",
  muted: "#6B6B76",
  border: "#E6E6EC",
  accent: "#7C3AED",
  keep: "#16A34A",
  archive: "#DC2626",
  shadow: "#000000",
};

const dark: typeof light = {
  background: "#0B0B0F",
  surface: "#17171D",
  surfaceAlt: "#22222A",
  text: "#F4F4F6",
  muted: "#9B9BA6",
  border: "#2A2A33",
  accent: "#A78BFA",
  keep: "#22C55E",
  archive: "#F87171",
  shadow: "#000000",
};

export type Palette = typeof light;

export function usePalette() {
  const scheme = useColorScheme();
  return { colors: scheme === "dark" ? dark : light, dark: scheme === "dark" };
}

export const isDemoMode = __DEV__ || process.env.EXPO_PUBLIC_DEMO_MODE === "true";

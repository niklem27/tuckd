import { useColorScheme } from "react-native";

export type ItemType = "event" | "place" | "product" | "recipe" | "todo" | "memory";

export const typeMeta: Record<
  ItemType,
  { label: string; plural: string; color: string; icon: string; action: string; actionIcon: string }
> = {
  event: { label: "Event", plural: "Events", color: "#7C6AE6", icon: "calendar", action: "Add to calendar", actionIcon: "calendar-outline" },
  place: { label: "Place", plural: "Places", color: "#E9A23B", icon: "location", action: "Open in Maps", actionIcon: "map-outline" },
  product: { label: "Product", plural: "Products", color: "#3F8CE8", icon: "pricetag", action: "Open link", actionIcon: "open-outline" },
  recipe: { label: "Recipe", plural: "Recipes", color: "#3FA66B", icon: "restaurant", action: "Save recipe", actionIcon: "bookmark-outline" },
  todo: { label: "To-do", plural: "To-dos", color: "#D9507A", icon: "checkbox", action: "Set reminder", actionIcon: "alarm-outline" },
  memory: { label: "Memory", plural: "Memories", color: "#A39E94", icon: "sparkles", action: "Tuck", actionIcon: "heart-outline" },
};

export const ITEM_TYPES = Object.keys(typeMeta) as ItemType[];

function mix(hex: string, target: number, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.round(((n >> shift) & 255) * (1 - amount) + target * amount);
  return `#${((1 << 24) | (channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).slice(1).toUpperCase()}`;
}

export function chipColors(type: ItemType, dark: boolean) {
  const color = typeMeta[type].color;
  return { background: color + "1F", text: dark ? mix(color, 255, 0.45) : mix(color, 0, 0.5) };
}

const STONE = "#A39E94";

const light = {
  background: "#FBF6EE",
  surface: "#FFFFFF",
  surfaceAlt: "#F3ECE1",
  text: "#173A40",
  muted: "#5E6B6D",
  border: "#E9E1D4",
  primary: "#C8553A",
  onPrimary: "#FFFFFF",
  accent: "#173A40",
  keep: "#C8553A",
  archive: STONE,
  danger: "#B42318",
  shadow: "#173A40",
};

const dark: typeof light = {
  background: "#0F2427",
  surface: "#183439",
  surfaceAlt: "#1F3F45",
  text: "#F3EEE6",
  muted: "#A7B4B5",
  border: "#24474D",
  primary: "#EE8B6C",
  onPrimary: "#0F2427",
  accent: "#F3EEE6",
  keep: "#EE8B6C",
  archive: STONE,
  danger: "#F97066",
  shadow: "#000000",
};

export type Palette = typeof light;

export function usePalette() {
  const scheme = useColorScheme();
  return { colors: scheme === "dark" ? dark : light, dark: scheme === "dark" };
}

export const isDemoMode = __DEV__ || process.env.EXPO_PUBLIC_DEMO_MODE === "true";

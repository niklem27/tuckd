import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Snapback",
      importance: AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

export async function getPushToken() {
  if (!Device.isDevice) return null;
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
  if (!projectId) return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (err) {
    console.warn("Push token unavailable", err);
    return null;
  }
}

type Remindable = {
  _id: string;
  type: string;
  title: string;
  startsAt?: number;
  remindAt?: number;
};

export function reminderTime(item: Remindable) {
  if (item.type === "todo") {
    if (item.remindAt) return item.remindAt;
    if (item.startsAt) return item.startsAt - DAY;
    const tomorrow = new Date(Date.now() + DAY);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow.getTime();
  }
  if (item.type === "event" && item.startsAt) return item.startsAt - 2 * HOUR;
  return null;
}

export async function scheduleItemReminder(item: Remindable) {
  const at = reminderTime(item);
  if (!at || at <= Date.now() + 5000) return null;
  const granted = (await Notifications.getPermissionsAsync()).granted;
  if (!granted) return null;
  await Notifications.scheduleNotificationAsync({
    identifier: `item-${item._id}`,
    content: {
      title: item.type === "event" ? "Coming up in 2 hours" : "Due tomorrow",
      body: item.title,
      data: { url: "/(tabs)/today" },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
  });
  return at;
}

export async function cancelItemReminder(itemId: string) {
  await Notifications.cancelScheduledNotificationAsync(`item-${itemId}`).catch(() => {});
}

export async function previewMorningBrief(count: number, firstTitle?: string) {
  const noun = count === 1 ? "thing" : "things";
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Good morning",
      body:
        count > 0
          ? `${count} ${noun} you saved matter today${firstTitle ? `, starting with ${firstTitle}` : ""}.`
          : "Nothing urgent today. Swipe through yesterday's screenshots?",
      data: { url: "/(tabs)/today" },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3 },
  });
}

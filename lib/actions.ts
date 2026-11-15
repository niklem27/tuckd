import { useMutation } from "convex/react";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useCallback } from "react";
import { Alert, Platform } from "react-native";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { addToCalendar } from "@/lib/calendar";
import { formatFullDate, formatTime } from "@/lib/format";
import { cancelItemReminder, scheduleItemReminder } from "@/lib/notifications";

export type ActionableItem = {
  _id: Id<"items">;
  type: "event" | "place" | "product" | "recipe" | "todo" | "memory";
  title: string;
  summary: string;
  startsAt?: number;
  endsAt?: number;
  remindAt?: number;
  location?: { name: string; address?: string };
  url?: string;
};

export function mapsUrl(location: { name: string; address?: string }) {
  const q = encodeURIComponent([location.name, location.address].filter(Boolean).join(", "));
  return Platform.OS === "ios" ? `http://maps.apple.com/?q=${q}` : `geo:0,0?q=${q}`;
}

function normalizeUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function useItemActions(notify: (message: string, onUndo?: () => void) => void) {
  const keep = useMutation(api.items.keep);
  const archive = useMutation(api.items.archive);
  const undo = useMutation(api.items.undo);
  const markDone = useMutation(api.items.markDone);
  const markActed = useMutation(api.items.markActed);

  const doKeep = useCallback(
    async (item: ActionableItem, message = "Kept") => {
      await keep({ itemId: item._id });
      scheduleItemReminder(item).catch(() => {});
      notify(message, () => {
        undo({ itemId: item._id });
        cancelItemReminder(item._id);
      });
    },
    [keep, undo, notify],
  );

  const doArchive = useCallback(
    async (item: ActionableItem) => {
      await archive({ itemId: item._id });
      cancelItemReminder(item._id);
      notify("Archived", () => undo({ itemId: item._id }));
    },
    [archive, undo, notify],
  );

  const act = useCallback(
    async (item: ActionableItem): Promise<boolean> => {
      try {
        switch (item.type) {
          case "event": {
            await addToCalendar(item);
            await markDone({ itemId: item._id });
            scheduleItemReminder(item).catch(() => {});
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            notify(
              `Added to calendar: ${formatFullDate(item.startsAt!)} at ${formatTime(item.startsAt!)}`,
              () => undo({ itemId: item._id }),
            );
            return true;
          }
          case "place": {
            if (!item.location) throw new Error("No location found on this screenshot.");
            await Linking.openURL(mapsUrl(item.location));
            await doKeep(item, `Saved ${item.location.name} to Places`);
            await markActed({ itemId: item._id });
            return true;
          }
          case "product": {
            if (item.url) await Linking.openURL(normalizeUrl(item.url));
            else
              await Linking.openURL(
                `https://www.google.com/search?q=${encodeURIComponent(item.title)}`,
              );
            await doKeep(item, "Saved to Products");
            await markActed({ itemId: item._id });
            return true;
          }
          case "todo": {
            await keep({ itemId: item._id });
            const at = await scheduleItemReminder(item);
            if (at) await markActed({ itemId: item._id });
            notify(
              at ? `Reminder set for ${formatFullDate(at)} at ${formatTime(at)}` : "Saved to To-dos",
              () => {
                undo({ itemId: item._id });
                cancelItemReminder(item._id);
              },
            );
            return true;
          }
          case "recipe":
            await doKeep(item, "Added to Saved › Recipes");
            return true;
          case "memory":
            await doKeep(item, "Kept in Memories");
            return true;
        }
      } catch (err) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        Alert.alert("Couldn't do that", err instanceof Error ? err.message : String(err));
        return false;
      }
    },
    [markDone, markActed, keep, undo, notify, doKeep],
  );

  return { keep: doKeep, archive: doArchive, act };
}

import * as Calendar from "expo-calendar/legacy";
import { Platform } from "react-native";

type EventLike = {
  title: string;
  summary: string;
  startsAt?: number;
  endsAt?: number;
  location?: { name: string; address?: string };
};

const HOUR = 60 * 60 * 1000;

async function writableCalendarId() {
  if (Platform.OS === "ios") {
    const cal = await Calendar.getDefaultCalendarAsync();
    return cal.id;
  }
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.filter((c) => c.allowsModifications);
  const primary = writable.find((c) => c.isPrimary) ?? writable[0];
  if (primary) return primary.id;
  return await Calendar.createCalendarAsync({
    title: "Tuckd",
    color: "#7C3AED",
    entityType: Calendar.EntityTypes.EVENT,
    name: "snapback",
    ownerAccount: "personal",
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
    source: { isLocalAccount: true, name: "Tuckd", type: "LOCAL" },
  });
}

export async function addToCalendar(item: EventLike) {
  if (!item.startsAt) throw new Error("This event has no date yet. Edit it and try again.");
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== "granted") throw new Error("Calendar access is off. Turn it on in Settings to add events.");
  const calendarId = await writableCalendarId();
  const location = item.location
    ? [item.location.name, item.location.address].filter(Boolean).join(", ")
    : undefined;
  await Calendar.createEventAsync(calendarId, {
    title: item.title,
    startDate: new Date(item.startsAt),
    endDate: new Date(item.endsAt ?? item.startsAt + HOUR),
    location,
    notes: `${item.summary}\n\nSaved with Tuckd`,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

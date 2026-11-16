import * as Calendar from "expo-calendar/legacy";
import * as Linking from "expo-linking";
import { Platform } from "react-native";

type EventLike = {
  title: string;
  summary: string;
  startsAt?: number;
  endsAt?: number;
  location?: { name: string; address?: string };
};

const HOUR = 60 * 60 * 1000;
const isGoogle = (cal: Calendar.Calendar) =>
  /google|gmail/i.test(`${cal.source?.name ?? ""} ${cal.source?.type ?? ""} ${cal.ownerAccount ?? ""}`) || /@gmail\.com$/i.test(cal.ownerAccount ?? "");

async function writableCalendar(): Promise<{ id: string; google: boolean }> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.filter((c) => c.allowsModifications);
  const google = writable.find((c) => isGoogle(c) && c.isPrimary) ?? writable.find(isGoogle);
  if (google) return { id: google.id, google: true };
  if (Platform.OS === "ios") return { id: (await Calendar.getDefaultCalendarAsync()).id, google: false };
  const primary = writable.find((c) => c.isPrimary) ?? writable[0];
  if (primary) return { id: primary.id, google: false };
  const id = await Calendar.createCalendarAsync({
    title: "Tuckd",
    color: "#7C3AED",
    entityType: Calendar.EntityTypes.EVENT,
    name: "snapback",
    ownerAccount: "personal",
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
    source: { isLocalAccount: true, name: "Tuckd", type: "LOCAL" },
  });
  return { id, google: false };
}

function eventDetails(item: EventLike) {
  if (!item.startsAt) throw new Error("This event has no date yet. Edit it and try again.");
  return {
    start: new Date(item.startsAt),
    end: new Date(item.endsAt ?? item.startsAt + HOUR),
    location: item.location ? [item.location.name, item.location.address].filter(Boolean).join(", ") : undefined,
    notes: `${item.summary}\n\nSaved with Tuckd`,
  };
}

export function googleCalendarUrl(item: EventLike) {
  const { start, end, location, notes } = eventDetails(item);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: item.title,
    dates: `${stamp(start)}/${stamp(end)}`,
    details: notes,
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  if (location) params.set("location", location);
  const event = `https://calendar.google.com/calendar/render?${params.toString()}`;
  return `https://accounts.google.com/ServiceLogin?${new URLSearchParams({ service: "cl", continue: event }).toString()}`;
}

export async function addToCalendar(item: EventLike, target: "device" | "google" = "device") {
  const { start, end, location, notes } = eventDetails(item);
  if (target === "google") {
    await Linking.openURL(googleCalendarUrl(item));
    return "Google Calendar";
  }
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== "granted") throw new Error("Calendar access is off. Turn it on in Settings to add events.");
  const calendar = await writableCalendar();
  await Calendar.createEventAsync(calendar.id, {
    title: item.title,
    startDate: start,
    endDate: end,
    location,
    notes,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return calendar.google ? "Google Calendar" : "calendar";
}

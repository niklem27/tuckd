import { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

export type InboxItem = FunctionReturnType<typeof api.items.inbox>[number];

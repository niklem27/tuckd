import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.cron("morning brief", "0 * * * *", internal.notifications.sendMorningBriefs, {});

export default crons;

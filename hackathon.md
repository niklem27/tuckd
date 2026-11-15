# Hackathon log

- **Project:** Snapback
- **What it does:** Reads the screenshots on your phone with a vision model and turns each one into a swipeable card you can keep, archive, or act on (calendar, Maps, link, reminder).
- **Live app:** not deployed
- **Repo:** private
- **Frontend:** not deployed
- **Convex deployment:** https://tough-ermine-387.convex.cloud
- **Components:** none
- **Convex features:** schema, tables, indexes, full-text search, queries, mutations, actions, HTTP actions, crons, scheduled functions, file storage, realtime queries
- **Auth:** Convex Auth
- **AI models:** gpt-4o-mini
- **Started:** 2026-11-15T18:33:27Z
- **Last updated:** 2026-11-15T21:05:00Z

## Log

### 2026-11-15 - a8008fa
Built the core app on Expo Router with a Convex backend and anonymous Convex Auth sign-in. Screenshots are found in the photo library, resized, uploaded to Convex file storage, and each one gets its own scheduled vision action that writes a typed item (event, place, product, recipe, to-do, memory) or marks it skipped when sensitive. The Inbox is a swipe deck (keep, archive with Undo, act now), with Today, Saved (full-text search) and Settings tabs, an hourly morning-brief cron, and eight bundled demo screenshots. Convex features: schema, indexes, search index, queries, mutations, internal actions, scheduler, file storage, crons, HTTP actions for auth (`convex/schema.ts`, `convex/screenshots.ts`, `convex/items.ts`, `convex/ai/`, `convex/notifications.ts`, `convex/crons.ts`, `components/SwipeDeck.tsx`, `lib/ingest.ts`).

### 2026-11-15 - 9171c1a
Added Revyl natural-language tests for first run, sensitive skip, triage, event to calendar, Today feed, inbox zero and nearby, plus a shared onboarding module and a workflow (`.revyl/tests/`, `.revyl/modules/`).

### 2026-11-15 - 2c5d18b
Switched extraction to the OpenAI SDK with the key read from a Convex environment variable, and shared one extraction function between the Convex action and the `npm run eval:ai` fixture script (`convex/ai/model.ts`, `convex/ai/processScreenshot.ts`, `scripts/eval-ai.ts`).

### 2026-11-15 - ccd20cd
Added a persistent Undo button for the last swipe next to the Inbox title, after a Revyl triage run showed the 5-second toast could expire before the tap (`app/(tabs)/inbox.tsx`).

### 2026-11-15 - a867e1b
Added the Screenshot Wrapped card at the top of Saved, computed by a Convex query that counts saved versus acted items per type, and shareable as an image. Acting on a place, product or to-do now records `actedAt`. Moved extraction to gpt-4o-mini, coerced numeric prices, and tightened the title rule; the fixture eval passes 8/8 (`convex/items.ts`, `components/WrappedCard.tsx`, `convex/ai/extraction.ts`).

### 2026-11-15 - working tree
Added a texting agent path. Convex HTTP actions take a screenshot from a chat sender (by URL or base64), store it, and run the same scheduled extraction as an in-app upload, then answer with a one-line result such as "Added Jazz Night at The Blue Room, Sun 8:00 PM ✓". A brief endpoint returns today's saved items as text, and a link endpoint ties a chat sender to an app account through a code from Settings › Text Snapback. The endpoints are guarded by a secret in the Convex environment. The agent itself runs on Keiki with these endpoints as webhook tools (`convex/http.ts`, `convex/agent.ts`, `app/(tabs)/settings.tsx`).

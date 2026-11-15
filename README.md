# tuckd

**Keep what matters, tuckd away.**

People take hundreds of screenshots of flyers, restaurants, products, recipes and deadlines, then never look at them again. Tuckd turns each screenshot into something you can act on, and a 30-second daily swipe keeps your camera roll useful.

## How it works
1. **Snap.** Take screenshots like you always do.
2. **Sort.** Tuckd's AI reads each one and turns it into a card: event, place, product, recipe, to-do or memory. Sensitive screenshots like bank balances and 2FA codes are skipped automatically.
3. **Swipe.** Right to tuck it, left to archive, up to act: add the event to your calendar, open the place in Maps, or set a reminder.
4. **Return.** Every morning, Tuckd tells you which of your saved things matter today.

## Features
- AI screenshot sorting with live-updating cards
- A daily swipe inbox with undo and an inbox-zero streak
- A Today view and a morning brief
- One-tap actions: calendar, Maps, links and reminders
- Screenshot Wrapped, e.g. "You saved 43 restaurants and went to 2"
- Sensitive-content filtering, and images are deleted after processing

## Built with
| Tool | Role |
|---|---|
| [Capy](https://capy.ai) | Wrote the app with parallel coding agents |
| [Convex](https://convex.dev) | Backend: database, file storage, AI actions, crons, auth |
| [Revyl](https://revyl.com) | Runs and tests the app on cloud iOS/Android devices |
| Expo + React Native | The mobile app (iOS and Android) |
| OpenAI | Vision model that sorts screenshots |

## Run it locally
```bash
npm install
npx convex dev          # starts the backend and writes EXPO_PUBLIC_CONVEX_URL to .env.local
npx convex env set OPENAI_API_KEY sk-...
npx expo start
```
In dev mode, tap **Load demo screenshots** to try it without your own camera roll.

## Testing
The core flows (onboarding, demo load, swipe triage, event to calendar, the Today feed) are tested on cloud iPhones with Revyl:
```bash
revyl dev --platform ios      # run the app on a cloud simulator
```
Test definitions are in `.revyl/tests/`.

---
Built at the Consumer Mobile Hackathon at YC, November 15, 2026.

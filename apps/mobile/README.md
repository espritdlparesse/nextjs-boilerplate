# EveryYou Mobile

Expo-based iOS/Android client scaffold for the existing EveryYou mini app.

## What is already here

- Mobile domain models currently live in `apps/mobile/shared/everyyou/domain.ts`
- Mobile UI mirrors the current product flow: `home`, `add`, `library`, `analysis`
- Mobile UI is structured into screens/components/hooks, even though navigation is currently local tab state
- Local persistence uses `AsyncStorage`, which is the mobile equivalent of the current web `localStorage`

## Run locally

1. `cd /Users/nastyad/Documents/GitHub/nextjs-boilerplate/apps/mobile`
2. `npm install`
3. `npm run start`
4. Press `i` in the Expo terminal or open the project in Expo Go / Simulator

## Backend setup

Set `EXPO_PUBLIC_API_BASE_URL` before starting Expo, for example:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000 npm run start
```

The mobile app will:

- create a guest token via `/api/auth/guest`
- load items from `/api/v2/items`
- send screenshots to `/api/analyze-screenshot` for OpenAI-based parsing
- import Spotify `track` and `album` links via `/api/spotify/import`
- fall back to local storage if the backend is unavailable

For iPhone testing on the same Wi-Fi, start Next.js with:

```bash
cd /Users/nastyad/Documents/GitHub/nextjs-boilerplate
npm run dev:network
```

Then set:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.2:3000
```

## OpenAI setup

The screenshot-import route requires:

- `OPENAI_API_KEY`
- optional `OPENAI_VISION_MODEL` defaulting to `gpt-4.1-mini`

## Spotify setup

The Spotify import route supports public `track`, `album`, and `playlist` links and requires:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

For account-level Spotify OAuth import, also add:

- `SPOTIFY_REDIRECT_URI`

For local iPhone testing on the same Wi-Fi, a typical value is:

```bash
SPOTIFY_REDIRECT_URI=http://192.168.1.2:3000/api/spotify/oauth/callback
```

This exact URL must also be added to your Spotify app Redirect URIs in the Spotify developer dashboard.

Once connected from the mobile app, you can import:

- liked songs
- recently played
- your playlists

## Important next steps

- Replace guest auth with a real account system
- Move analysis to the shared backend instead of local-only storage
- Split the single `App.tsx` screen into reusable mobile components and navigation
- Rework Telegram-only auth in `/app/api/items/route.ts` so native clients can use the same API

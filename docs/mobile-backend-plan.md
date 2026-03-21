# Mobile Backend Plan

## What changed

- Existing Telegram-only CRUD remains in `/app/api/items/route.ts`
- New universal API lives in `/app/api/v2/items/route.ts`
- Native clients can get a signed guest token from `/app/api/auth/guest/route.ts`
- Auth parsing now supports either:
  - `x-telegram-init-data` for the current Telegram mini app
  - `Authorization: Bearer <token>` for iOS or other native clients

## Required environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN` for Telegram auth
- `EVERYYOU_APP_AUTH_SECRET` for native guest tokens

## Local network development

To make the backend reachable from an iPhone on the same Wi-Fi network, run:

```bash
npm run dev:network
```

Then point the mobile app to:

```bash
EXPO_PUBLIC_API_BASE_URL=http://<your-mac-lan-ip>:3000
```

You can also verify the server from the phone by opening:

```text
http://<your-mac-lan-ip>:3000/api/health
```

## Required database migration

Apply `/supabase/migrations/20260321_everyyou_owner_identity.sql` so the `items` table can store a universal owner identity:

- `owner_key`
- `owner_kind`

Telegram rows are backfilled to `owner_key = tg:<telegram_user_id>`.

## Current limitation

The native flow is guest-based for now. It gives iOS a stable signed identity per device, which is enough to unblock product development, but it is not yet a full account system.

## Next recommended step

Replace guest device auth with a real account model:

- Supabase Auth
- Sign in with Apple
- or Telegram-to-native account linking if you want the same person to share data across both clients

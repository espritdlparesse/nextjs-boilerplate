# Everyyou

A Telegram mini app: a library of music, books and films, plus the vibecheck — a short roast
built from it.

## Two clients, one server

`app/` is the web client inside Telegram. `apps/mobile/` is React Native and calls the same
`/api/v2/*` routes, so a route change affects both. Mobile keeps its own
`apps/mobile/lib/api.ts` and its own copy of the domain types in
`apps/mobile/shared/everyyou/domain.ts`.

## Commands

```
npm run dev          development
npm run build        build
npm test             tests
npm run migrate      apply database migrations
npm run warm-context fill the cultural memory
npm run complexity   report functions over the limit
```

Tests use Node's own runner: vitest wants `@types/node` 22 against this project's 20. Node
runs TypeScript directly here, so `.mjs` scripts import `.ts` from `lib/` without a build step.

## Database

Supabase. Migrations are files in `supabase/migrations/`, applied by `npm run migrate`, which
records each one in `schema_migrations`.

**The filename sets the order**, so a file that references another table must sort after it.

`SUPABASE_DB_URL` must be a connection on port 5432; the pooler on 6543 cannot run DDL. The
direct host `db.*.supabase.co` resolves to IPv6 only, so a machine without IPv6 needs the
pooler host.

## Checks

```
npm test && npm run build && npx eslint app lib && npm run complexity
```

One pass per set of edits, at the end. Do not run them after deleting a comment, renaming a
local variable or reformatting — those edits cannot change behaviour. Do not re-run a suite
that already passed. Say which result you are reporting and which edits came after it.

## Cyclomatic complexity

The limit is 20 per function. Measure, do not estimate: `npm run complexity` prints everything
above it, worst first. The script is `scripts/complexity.py` and excludes itself.

Currently over the limit:

```
420  apps/mobile/hooks/useEveryYouApp.ts  useEveryYouApp
 75  apps/mobile/App.tsx                  App
 50  app/api/v2/deep-analysis/route.ts    POST
```

The method that took `Page` from 698 to 350: measure the group's free identifiers, lift the
group that shares state, qualify the references. Guessing the dependency list once produced
112 type errors.

Splitting can raise the count of functions over the limit, because an extracted hook becomes
visible on its own. That is not a regression if the parent dropped.

## 500 lines per file

At the limit, split rather than append. File length and function complexity are different
measures: `app/everyyou.css` has no branches at all and still had to come out of the component.

These are still over. They are not rewritten wholesale, but every edit inside one must leave
it shorter:

```
2284  apps/mobile/hooks/useEveryYouApp.ts
1394  apps/mobile/styles/appStyles.ts
1125  app/everyyou.css
 945  apps/mobile/screens/LibraryScreen.tsx
 834  apps/mobile/screens/AddScreen.tsx
 798  apps/mobile/App.tsx
 684  app/api/v2/analysis/route.ts
 560  apps/mobile/screens/AnalysisScreen.tsx
 556  apps/mobile/lib/api.ts
 548  app/page.tsx
```

A new file starts short and stays short.

## Search before you write

**Before adding a function, type, constant or file, grep for it.** Not from memory: one grep,
then the answer. Say which existing implementation you reused, or that you looked and found
none.

Search for the shape as well as the name — a normaliser, a parser, a retry, a conversion.
This repository repeats itself: the Telegram user resolver stood in four routes under two
names, the seeded RNG in three engines, the date helpers three times, the calendar grid four
times, the profile importer twice in each client.

Shared code lives in `lib/`: `mediaTypes`, `itemSources`, `dates`, `seededRandom`, `topEntry`,
`admins`, `telegram`, `spotify`, `culturalCards`. Look there first, then at a sibling module
solving the same problem. When a shared function is close but not enough, extend it in place.

The mobile client imports from `lib/` by relative path — its tsconfig has no `@/lib` alias.

## Web client layout

The file layout mirrors the interface. A tab is a file in `app/tabs/`: `HomeTab`,
`ProfileTab`, `AddTab`, `LibraryTab`, `VibeTab`. State is a hook in `app/hooks/`:
`useVibecheck`, `useDeepVibe`, `useLibrary`, `useImports`, `useProfile`, `useAddForm`,
`useShareCard`. Shared pieces sit beside them: `app/types.ts`, `app/apiFetch.ts`,
`app/analytics.ts`.

`page.tsx` holds only the shell — state the tabs share, navigation, modals.

A tab takes whole hooks as props, not state picked apart: `AddTab` needed thirty props until
the form and the categories became `useAddForm`.

## Comments

Default to none. Comment only what the code cannot say: a non-obvious invariant, a protocol
constraint, a workaround for external behaviour, a measured number, a reason a reader would
otherwise undo the change.

Do not restate the line below. Do not narrate what was there before. Do not label sections. A
new file opens with code, not with prose about the design.

## Tests

Default to none. Write one when the logic is easy to get wrong, or to pin a fix for something
that broke. Do not write a test proving that code you just wrote does what it says.

The tests in `lib/__tests__/` cover only what decides something: the source normaliser, where
three copies disagreed, and the card filter, which gates what reaches a prompt.

## Traps

`\b` in a regex matches on `[A-Za-z0-9_]` and never fires before Cyrillic. Use
`(^|[^\p{L}])` with the `u` flag.

A property access does not narrow: `library.selectedDay` is still nullable after its own null
check. Bind it to a local first.

The vibecheck is documented separately in `docs/vibecheck.md`: the path of a request, what it
reads, and the filters.

Admins are numeric Telegram ids in `lib/admins.ts`, never usernames — a username can be
released and claimed by someone else.

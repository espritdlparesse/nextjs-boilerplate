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
npm run typecheck    web client
npm run typecheck:mobile  mobile client
npm run check        all of the above
```

`apps/mobile` has its own `node_modules`. Run `npm i` there once, or
`typecheck:mobile` cannot resolve expo and react-native and silently reports nothing useful.

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
npm run check
```

That is `npm test`, both typechecks, `npm run lint`, `npm run build` and `npm run complexity`.

`npm run lint` runs with `--max-warnings 0` and is clean, so any new warning fails the check.
`no-explicit-any` is an error, not a warning. Do not lower either back to keep a change
moving.

One pass per set of edits, at the end. Do not run them after deleting a comment, renaming a
local variable or reformatting — those edits cannot change behaviour. Do not re-run a suite
that already passed. Say which result you are reporting and which edits came after it.

## Cyclomatic complexity

The limit is 20 per function. Measure, do not estimate: `npm run complexity` prints everything
above it, worst first. The script is `scripts/complexity.py`; it measures itself too.

Nothing is over the limit right now. Keep it that way.

The method: measure the group's free identifiers, lift the group that shares state, qualify
the references. Guessing the dependency list once produced 112 type errors.

`scripts/complexity.py` charges a function for everything nested inside it, so a hook that
holds ten closures is scored as one function. Keep logic in module-level functions that take
an explicit context object; let the hook hold state and wiring.

Splitting can raise the count of functions over the limit, because an extracted hook becomes
visible on its own. That is not a regression if the parent dropped.

## 500 lines per file

At the limit, split rather than append. File length and function complexity are different
measures: `app/everyyou.css` has no branches at all and still had to come out of the component.

Nothing is over 500 lines right now. The longest is about 485.

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
`admins`, `telegram`, `telegramWebApp`, `spotify`, `culturalCards`, `fileImports`, `text`,
`plural`, `vibeItems`, `textLists`. Look there first, then at a sibling module solving the
same problem. When a shared function is close but not enough, extend it in place.

The mobile client imports from `lib/` by relative path — its tsconfig has no `@/lib` alias.
A file in `lib/` that mobile imports must therefore use relative paths internally too, and if
`npm test` imports it, those paths need the `.ts` extension: Node's ESM resolver takes no
aliases and adds no extensions. Both tsconfigs set `allowImportingTsExtensions`.

## Web client layout

The file layout mirrors the interface. A tab is a file in `app/tabs/`: `HomeTab`,
`ProfileTab`, `AddTab`, `LibraryTab`, `VibeTab`. State is a hook in `app/hooks/`:
`useVibecheck`, `useDeepVibe`, `useLibrary`, `useImports`, `useProfile`, `useAddForm`,
`useShareCard`. Shared pieces sit beside them: `app/types.ts`, `app/apiFetch.ts`,
`app/analytics.ts`.

`page.tsx` holds only the shell — state the tabs share, navigation, modals.

**A hook must not return a ref.** `react-hooks/refs` treats an object that carries a ref as
ref-tainted, so one `fileRef` in a hook's return made every read of that hook's result in
render an error — 33 of them from three refs. A widget that needs a DOM node owns it:
`app/components/FilePickerButton.tsx` keeps the hidden `<input type="file">` and its ref next
to the button that opens it.

Keep the widget next to the click for a second reason: while the csv `<input>` lived in
`AddTab` and the modal that opened it lived in `page.tsx`, "или выбрать csv" did nothing at
all on the profile tab, because `AddTab` was not mounted.

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
three copies disagreed; the card filter, which gates what reaches a prompt; and the CSV
reader, which silently corrupted an import on a quoted newline and on a `;` delimiter.

## Types

`strict` is on in both clients and there is no `any` left in `app/`, `lib/`, `scripts/` or
`apps/mobile/`. Keep it that way: when a payload really is unknown, declare its shape with
`unknown` fields and read them with a check, rather than reaching for `any`.

`errorMessage` in `lib/text.ts` covers both error shapes this repo has — a thrown `Error` and
a Supabase result error, whose `message` sits on a plain object. Use it instead of
`catch (e: any)`.

The Telegram WebApp global is declared in `lib/telegramWebApp.ts`. Reach it through
`telegramWebApp()`, never through `window as any` — two real bugs hid behind that cast,
both unguarded calls to methods an older client may not expose.

## Traps

`\b` in a regex matches on `[A-Za-z0-9_]` and never fires before Cyrillic. Use
`(^|[^\p{L}])` with the `u` flag.

A property access does not narrow: `library.selectedDay` is still nullable after its own null
check. Bind it to a local first.

The vibecheck is documented separately in `docs/vibecheck.md`: the path of a request, what it
reads, and the filters.

Admins are numeric Telegram ids in `lib/admins.ts`, never usernames — a username can be
released and claimed by someone else.

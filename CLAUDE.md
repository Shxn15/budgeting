# Budgeting – notes for Claude

Personal finance desktop app for Windows, built iteratively with the owner (German speaker).
Wails v2 (Go) shell + React 19 / TypeScript / Vite frontend. See README.md (German) for structure.

## Conventions

- UI text is German (informal "du"); code, identifiers and code comments are English.
- Talk to the user in German.
- Money is always integer cents (`Cents`); parse input with `parseMoney`, format with `formatMoney`.
- Dates are local calendar days `YYYY-MM-DD` (`domain/dates.ts`), timestamps are ISO strings.
- Balances are never stored; they are derived from transactions (`domain/ledger.ts`).
- All data changes are pure functions in `domain/operations.ts` (with tests), exposed via `store/actions.ts`.
- Account colours are palette keys (`domain/colors.ts`, CSS vars `--series-*`); keep the palette order.
- Styling: CSS variables from `styles/tokens.css` only (light + dark), co-located `.css` per component.
- Profile pictures (tags, subscriptions) are small square data URLs stored inside data.json
  (`domain/images.ts`, `components/avatar/imageProcessing.ts`) – never file paths, so backups contain them.
- Subscriptions: charge dates are `anchorDate` + n × interval (`domain/subscriptions.ts`); due automatic charges are
  booked by `processDueSubscriptions`, triggered from `app/App.tsx` (start, midnight, after changes).
- Statistics count `expense`, `payment` and `subscription` bookings, grouped by tag (`domain/spending.ts`).
- Bookings with `affectsBalance: false` are statistics-only; `computeBalances` skips them.
- Upcoming payments are a month plan (`buildUpcomingPlan` in `domain/upcoming.ts`): current month incl. overdue,
  later months (UI folds them: "Dezember (3)"), undated. "Anstehend" = current month only.
  "Frei verfügbar" = `computeFreeMoney`: balances without savings accounts minus this month's items not paid from savings.
- Receivables ("Bekomme ich noch", `domain/receivables.ts`): money others owe me, optional date; "Erhalten" books an
  `income` booking linked via `receiptTransactionId` (deleting that booking reopens the entry). Not part of free money.
- Savings goals (`domain/savings.ts`): only for `type: 'savings'` accounts, nested via `parentId` (max 4 levels).
  Only the assignment `allocated` is stored; a goal's total = own + sub-goals. Never assign more than the free money.
- Colour themes: key in `settings.colorTheme` (`domain/themes.ts`), CSS in `styles/tokens.css` under
  `:root[data-palette='…']` (+ `[data-theme='dark']`), window background per theme in `main.go` (`backgrounds`).
  Light/dark stays `settings.theme`. index.html applies both from localStorage before the first paint.
- Foldable sections are remembered in `settings.collapsedSections` (`useCollapsed` in `store/selectors.ts`).

## Delivering builds (user's explicit wish)

After every change, build the exe (`./scripts/build-windows.sh`) and send it to the user in the chat
with SendUserFile: the `.exe` itself plus a `.zip` of it (some browsers/Windows block raw .exe downloads).

## Data compatibility is sacred

The user's data must survive every update.

- Never change `dataDirName` in `main.go` (data lives in `%APPDATA%\Budgeting`).
- Any change to the stored document format: bump `CURRENT_SCHEMA_VERSION`, add a migration in
  `persistence/migrations.ts`, update `normalize.ts`, add a test with a real old file.
- Never edit released migrations or the `SCHEMA_1_FILE` / `SCHEMA_2_FILE` / `SCHEMA_3_FILE` fixtures in
  `persistence/persistence.test.ts`.
- A file with a newer schema version must stay untouched (read-only screen).

## Commands

- Frontend: `cd frontend && npm run typecheck && npm test && npm run build`
- Backend: `go test ./internal/...`
- Windows exe (cross-compiles anywhere): `./scripts/build-windows.sh`
- Version number: `info.productVersion` in `wails.json` (single source of truth).

## Verifying UI changes

`npm run build && npx vite preview` in `frontend/`, then drive it with Playwright. In the browser the
backend is a localStorage stand-in (`platform/backend.ts`), so all flows work without Wails.

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

## Delivering builds (user's explicit wish)

After every change, build the exe (`./scripts/build-windows.sh`) and send it to the user in the chat
with SendUserFile: the `.exe` itself plus a `.zip` of it (some browsers/Windows block raw .exe downloads).

## Data compatibility is sacred

The user's data must survive every update.

- Never change `dataDirName` in `main.go` (data lives in `%APPDATA%\Budgeting`).
- Any change to the stored document format: bump `CURRENT_SCHEMA_VERSION`, add a migration in
  `persistence/migrations.ts`, update `normalize.ts`, add a test with a real old file.
- Never edit released migrations or the `SCHEMA_1_FILE` fixture in `persistence/persistence.test.ts`.
- A file with a newer schema version must stay untouched (read-only screen).

## Commands

- Frontend: `cd frontend && npm run typecheck && npm test && npm run build`
- Backend: `go test ./internal/...`
- Windows exe (cross-compiles anywhere): `./scripts/build-windows.sh`
- Version number: `info.productVersion` in `wails.json` (single source of truth).

## Verifying UI changes

`npm run build && npx vite preview` in `frontend/`, then drive it with Playwright. In the browser the
backend is a localStorage stand-in (`platform/backend.ts`), so all flows work without Wails.

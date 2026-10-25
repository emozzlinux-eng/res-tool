# Inventory Pro

Offline-first PWA for bakery inventory: log production, waste and restocks; auto-deduct recipe ingredients; generate per-supplier purchase orders with WhatsApp/copy actions.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run build      # outputs to dist/
```

## Features

- **Home** — today's produced/waste/restock stats, low-stock alerts, recent activity.
- **Manage** — log Produced / Waste / Restock entries with a quantity stepper, live deduction preview, shortage warnings, and undo (restores stock from the entry's recorded changes).
- **Restock** — searchable inventory with LOW/OUT badges, quick add-stock, and a "Generate Orders" sheet grouped by supplier (WhatsApp deep link + clipboard copy).
- **Profile** — change PIN, auto-lock timer, replay tutorial, lock now, full CRUD editors for foods/recipes/raw items/suppliers (renames cascade), dark mode, JSON backup/restore, CSV log export, reset all data.
- **Security** — 6-digit PIN hashed with PBKDF2-SHA256 + random salt (WebCrypto); legacy weak hashes are upgraded transparently on unlock. Auto-lock after inactivity.
- **PWA** — service worker (`public/sw.js`) caches the app shell for offline use; installable via `manifest.webmanifest` with icons. Zoom is allowed (accessible viewport).

## Data & sync notes

All data lives in `localStorage` (single workspace blob) — no account or cloud sync is included. The unused Supabase/router/etc. dependencies were removed. If multi-device sync is added later, treat any shared sync key like a password and store records individually so devices can merge instead of overwrite.

### xlsx advisory

We keep `xlsx@0.18.5` (the last npm release). It has known advisories (prototype pollution / ReDoS in the **parser**). This app only ever **writes** spreadsheets with SheetJS and never parses untrusted `.xlsx` files, so the vulnerable code paths are not reachable. If that changes (e.g. importing workbooks from disk), switch to the maintained SheetJS build (`https://cdn.sheetjs.com`) or `exceljs` first.

## Scripts

```bash
npm run dev         # Vite dev server (binds 0.0.0.0 for LAN/mobile testing)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm test            # vitest run
npm run test:watch  # vitest watch mode
npm run format      # prettier --write src
npm run build       # production build + generated service worker (dist/)
npm run preview     # serve the built dist/ locally
```

## Deploy

`netlify.toml` builds with Vite and publishes `dist/` with an SPA fallback redirect.

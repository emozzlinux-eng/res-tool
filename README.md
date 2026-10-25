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

## Deploy

`netlify.toml` builds with Vite and publishes `dist/` with an SPA fallback redirect.

# Papers & Petals — Back Office

Flowers-only operations system for **Papers & Petals** (Dagupan, San Carlos, Urdaneta).

**Production URL:** [papers-and-petals.vercel.app](https://papers-and-petals.vercel.app) (rename in Vercel: Project Settings → General → Project Name → `papers-and-petals`)

## Features

- Staff/admin login (Supabase Auth in production)
- Calendar + list order views with full order form + photo uploads
- Flower type + quantity lines, manual total price, auto balance
- Per-branch inventory with admin stock in/out and inter-branch transfers
- Stock deducts when **all orders for a pickup day** are picked up, delivered, or completed
- Staff expenses + admin supplier costs
- Reports with net income; staff reports gated until pickup day is closed
- Printable day/week/month sales by branch

## Demo vs live

| | Demo (`flower_demo`) | Production |
|--|----------------------|------------|
| Data | Browser localStorage | Supabase (shared) |
| Login | One-tap Admin/Staff | Email + password |
| Photos | Compressed in browser | Supabase Storage |

## Demo login (local / Vercel demo only)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@papersandpetals.ph | admin1234 |
| Staff | staff1@papersandpetals.ph | staff1234 |

## Run locally

```bash
npm install
npm run dev
```

Set `VITE_APP_MODE=flower_demo` for demo mode.

## Supabase go-live

Run these in the Supabase SQL editor **in order**:

1. `supabase/schema_flowers_v2.sql` — tables, RLS, photo bucket
2. `supabase/seed_flowers_products_and_stock.sql` — starter products + stock per branch

Then:

3. Create users in **Authentication** → add matching rows in `flower_profiles` (see `docs/HANDOVER.md`)
4. Set env vars on Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_FLOWER_STORAGE_MODE=supabase`
   - `VITE_APP_MODE=cafe` (not `flower_demo`)

Full checklist: `docs/HANDOVER.md`

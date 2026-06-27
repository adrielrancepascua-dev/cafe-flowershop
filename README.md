# Papers & Petals — Flower Back Office

Flowers-only operations system for **Papers & Petals** (Dagupan, San Carlos, Urdaneta).

## Features

- Staff/admin login
- Calendar + list order views with full Notion-style order form
- Flower type + quantity lines, manual total price, auto balance
- Per-branch inventory with admin stock in/out and inter-branch transfers
- Stock deducts when orders are marked **completed**
- Staff expenses + admin supplier costs
- Reports with net income; staff reports gated until pickup day is closed

## Demo login (local mode)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@papersandpetals.ph | admin1234 |
| Staff | staff1@papersandpetals.ph | staff1234 |

## Run locally

```bash
npm install
npm run dev
```

Set `VITE_APP_MODE=flower_demo` (default on Vercel via `vercel.json`).

## Supabase (optional)

1. Run `supabase/schema_flowers_v2.sql`
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

Without Supabase, the app uses browser local storage (demo-friendly).

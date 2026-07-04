# Papers & Petals — Go-live handover checklist

Use this before collecting the ₱30k balance. Run on the **production** deploy (Supabase configured, `VITE_FLOWER_STORAGE_MODE=supabase`, **not** `flower_demo` mode).

## Environment

- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set on Vercel
- [ ] `VITE_FLOWER_STORAGE_MODE=supabase`
- [ ] `VITE_APP_MODE` is **not** `flower_demo` (use `cafe` or omit)
- [x] `supabase/schema_flowers_v2.sql` applied in Supabase SQL editor
- [ ] `supabase/fix_flower_branches_rls.sql` applied (if branch dropdown is empty)
- [ ] `supabase/seed_flowers_products_and_stock.sql` applied (products + starting stock)
- [ ] `supabase/add_flower_product_color.sql` applied (flower color categories on Products)
- [ ] `supabase/add_flower_product_kind.sql` applied (Miscellaneous tab for wrappers, chocolates, etc.)
- [ ] `supabase/add_staff_management.sql` applied (team page + first-login onboarding)
- [ ] `supabase/seed_admin_aleajcq.sql` applied after creating Auth user **aleajcq@gmail.com** (temp password `1234`; owner sets personal password on first login — no branch step)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set on Vercel (server only — enables **Team** page to create staff)
- [ ] `VITE_STAFF_EMAIL_DOMAIN` set if staff emails should not use `papersandpetals.ph`
- [ ] `supabase/add_inventory_transfer_requests.sql` applied (inter-branch transfer requests)
- [ ] `supabase/add_inventory_transfer_items.sql` applied (multi-product transfer lines)
- [ ] `supabase/add_flower_supply_transfers.sql` applied (admin Supplies tab vouchers)

### Create the first admin (one-time)

```sql
insert into public.flower_profiles (id, email, display_name, role, onboarding_completed)
values (
  '<auth-user-uuid>',
  'admin@papersandpetals.ph',
  'Shop Admin',
  'admin',
  true
);
```

After that, the owner adds staff from **Team** in the app (temporary password `1234`; staff pick branch + new password on first login).

### Legacy manual staff (optional)

```sql
insert into public.flower_profiles (id, email, display_name, role, onboarding_completed)
values (
  '<auth-user-uuid>',
  'staff@papersandpetals.ph',
  'Staff Name',
  'staff',
  true
);
```

## Two-device smoke test

Use two phones (or one phone + laptop) logged in as **different staff** accounts.

### 1. Shared orders

- [ ] Device A: create an order for tomorrow, Dagupan branch, with 2 line items
- [ ] Device B: refresh Orders — same order appears with correct receiver and total
- [ ] Device B: change status to **Ready**
- [ ] Device A: status update visible without clearing cache

### 2. Photo uploads

- [ ] Device A: create order with inspo photo + order form screenshot (and DP proof if DP > 0)
- [ ] Device B: open order — photos load from cloud URLs (not broken thumbnails)
- [ ] Upload 3 photos across 2 orders in one session — no browser quota errors

### 3. Day close + inventory

Pick a test day with 2+ orders (or create them for today).

- [ ] Mark all non-cancelled orders for that pickup day as **Picked up**, **Delivered**, or **Completed**
- [ ] Reports for that day unlock for staff (day is closed)
- [ ] Inventory deducts **once** when the last order on that day reaches a terminal status — not before
- [ ] Stock levels match expected counts after day close

### 4. Expenses & reports

- [ ] Staff adds an expense on Device A
- [ ] Admin sees it on Device B under Expenses
- [ ] Admin adds supplier cost; net income on Reports matches: sales − staff expenses − supplier costs
- [ ] Printable day/week/month report totals match Reports page

### 5. Inter-branch transfer (with receiving-branch approval)

- [ ] Staff/admin file a transfer request (e.g. Dagupan → Urdaneta); stock leaves the source branch immediately
- [ ] Receiving branch sees the incoming request and taps **Confirm received**
- [ ] Only after confirmation does the stock appear in the receiving branch's on-hand
- [ ] Rejecting (receiver) or cancelling (sender) a pending request returns the stock to the source branch
- [ ] Both branches show updated on-hand on both devices

### 6. Supplies (admin)

- [ ] Admin opens **Supplies** → New arrivals voucher saves and updates inventory
- [ ] Total liability = flower cost + supplies + transpo (new arrivals) or flower cost only (old stock)
- [ ] History list shows vouchers; print voucher works

### 7. Production login

- [ ] Demo one-tap Admin/Staff buttons **not** shown on login page
- [ ] Real email/password login works for admin and staff
- [ ] Staff cannot access Products admin page
- [ ] Demo mode banner **not** shown when Supabase + supabase storage mode are active

## Staff training (15 minutes)

1. **Orders** — calendar vs list; create order; upload photos; status workflow (not started → ready → picked up/delivered)
2. **Inventory** — view stock; stock in/out; inter-branch transfer requests (file a request; receiving branch confirms before stock is added)
3. **Expenses** — log petty cash; admin can fix typos
4. **Reports** — locked until all today’s orders are done; screenshot printable report for Messenger
5. **Team** (admin) — add staff, copy login details, deactivate leavers
6. **Day close rule** — stock comes out when every order for that pickup day is finished, not when each order is marked ready

## Rollback

If production fails during handover week:

- Set `VITE_FLOWER_STORAGE_MODE=local` temporarily (single-device demo only — not for daily ops)
- Fix Supabase issue, re-run smoke test, switch back to `supabase`

## Sign-off

| Check | Client | Developer | Date |
|-------|--------|-----------|------|
| Two-device orders sync | ☐ | ☐ | |
| Photos reliable | ☐ | ☐ | |
| Stock matches reports | ☐ | ☐ | |
| Real logins only | ☐ | ☐ | |
| Staff trained | ☐ | ☐ | |

Client signature: _________________________

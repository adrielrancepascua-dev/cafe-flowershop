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
- [ ] `supabase/add_atomic_stock_rpc.sql` applied (atomic inventory stock updates)
- [ ] `supabase/fix_adjust_flower_stock_security.sql` applied (harden stock RPC for staff writes)
- [ ] `supabase/add_flower_transfer_billing.sql` applied (admin-only transfer cost + paid/unpaid tracking)
- [ ] `supabase/add_flower_order_content_edit_policy.sql` applied (one staff edit until 6 PM on order day)
- [ ] `supabase/add_flower_expense_payment_mode.sql` applied (cash vs GCash on staff expenses)
- [ ] `supabase/add_flower_daily_inventory.sql` applied (daily flower + gift item counts; report lock)
- [ ] `supabase/add_inventory_movement_actor.sql` applied (who did stock in/out on each movement; tap a color for its daily log)
- [ ] Optional: run `supabase/verify_production_readiness.sql` — all checks pass

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
- [ ] Staff can **edit an order once until 6:00 PM** on the day it was created (e.g. update flowers after assembling a Thumbelina bouquet); after one save or after 6 PM, **Edit order** is hidden
- [ ] **Admin can edit any order unlimited times**, any day — no 6 PM or once-only limit
- [ ] Each order shows **input time** (when it was typed in, not pickup). Admin **Supplier** tab: copy the list, tap **Already ordered these** (stays highlighted). Old orders hide; new ones appear as they are typed. Copy then sends only the new flowers, fillers, and misc. **Redo** brings the full list back.

### 2. Photo uploads

- [ ] Device A: create order with inspo photo + order form screenshot (and DP proof if DP > 0)
- [ ] Device B: open order — photos load from cloud URLs (not broken thumbnails)
- [ ] Upload 3 photos across 2 orders in one session — no browser quota errors

### 3. Day close + inventory

Pick a test day with 2+ orders (or create them for today).

- [ ] Mark all non-cancelled orders for that pickup day as **Picked up**, **Delivered**, or **Completed**
- [ ] Reports for that day unlock for staff only after day close **and** daily inventory submit
- [ ] Inventory deducts **once** when the last order on that day reaches a terminal status — not before
- [ ] Stock levels match expected counts after day close

### 4. Expenses & reports

- [ ] Staff adds an expense on Device A — choose **Cash** or **GCash** payment mode
- [ ] Admin sees it on Device B under Expenses with paid-via label
- [ ] Reports **Cash on hand** = cash sales − cash expenses only (GCash expenses listed separately)
- [ ] Admin adds supplier cost; net income on Reports matches: sales − staff expenses − supplier costs
- [ ] Printable day/week/month report totals match Reports page

### 5. Inter-branch transfer (with receiving-branch approval)

- [ ] **`supabase/add_inventory_transfer_items.sql` applied** — required; without it transfers fail with `product_id` not-null error
- [ ] After a deploy that changes auth/inventory, staff **sign out and sign in once** if transfers fail with "session expired"
- [ ] Staff/admin file a transfer request (e.g. Dagupan → Urdaneta); stock leaves the source branch immediately
- [ ] Sending branch can **Print slip** (packing list: from/to, flower + color + qty) to put in the plastic for the receiving branch to check
- [ ] Receiving branch sees the incoming request and taps **Confirm received**
- [ ] Only after confirmation does the stock appear in the receiving branch's on-hand
- [ ] Rejecting (receiver) or cancelling (sender) a pending request returns the stock to the source branch
- [ ] Both branches show updated on-hand on both devices

### 5b. Transfer billing (admin only)

- [ ] Admin opens **Inventory → Transfers** — each transfer card shows **Branch billing · admin only** at the bottom
- [ ] Admin enters total cost and marks **Unpaid** or **Paid**; staff accounts do not see billing fields
- [ ] **Unpaid branch balances** summary lists what one branch still owes another (e.g. San Carlos → Dagupan)
- [ ] Billing can be updated on pending requests and in transfer history after confirmation

### 5c. Daily inventory count

- [ ] **`supabase/add_flower_daily_inventory.sql` applied**
- [ ] Staff open **Daily count** / **Count**, expand a flower, search if needed, and enter actual qty (blank variants save as 0)
- [ ] After submit, variance = actual − expected remaining after today’s completed sales (even before 7:00 PM deduct)
- [ ] Submit does **not** change stock; staff can **Edit counts** if it was submitted too early
- [ ] Admin reviews short/extra at night and adjusts Inventory manually if confirmed
- [ ] Staff **Reports** stay locked until today’s count is submitted (in addition to day close + incoming transfers)

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

1. **Orders** — calendar vs list; create order; upload photos; status workflow (not started → ready → picked up/delivered). **Input time** is when the order was typed in (not pickup). Admin **Supplier** tab: copy, tap **Already ordered these** (highlights). Only new orders remain; copy is new-only. **Redo** shows everything again.
2. **Inventory** — view stock; stock in/out; inter-branch transfer requests (file a request; receiving branch confirms before stock is added)
3. **Daily count** — enter actual flower + gift item counts before leaving; wrappers skipped; does not auto-adjust stock
4. **Expenses** — log petty cash; admin can fix typos
5. **Reports** — locked until today’s orders are closed **and** daily count is submitted; screenshot printable report for Messenger
6. **Team** (admin) — add staff, copy login details, deactivate leavers
7. **Day close rule** — stock comes out when every order for that pickup day is finished, not when each order is marked ready

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

-- Track whether a staff expense was paid from cash or GCash.
-- GCash expenses should not reduce expected cash on hand on Reports.

alter table public.flower_staff_expenses
  add column if not exists payment_mode text not null default 'cash'
    check (payment_mode in ('cash', 'gcash'));

-- Ensure co-admin can read/write expenses (safe to re-run).
drop policy if exists "flower_staff_expenses_access" on public.flower_staff_expenses;
create policy "flower_staff_expenses_access"
  on public.flower_staff_expenses for all
  to authenticated
  using (public.flower_current_role() in ('staff', 'admin', 'co_admin'))
  with check (public.flower_current_role() in ('staff', 'admin', 'co_admin'));

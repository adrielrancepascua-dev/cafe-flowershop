-- Track whether a staff expense was paid from cash or GCash.
-- GCash expenses should not reduce expected cash on hand on Reports.

alter table public.flower_staff_expenses
  add column if not exists payment_mode text not null default 'cash'
    check (payment_mode in ('cash', 'gcash'));

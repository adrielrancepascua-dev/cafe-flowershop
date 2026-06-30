-- Run in Supabase SQL editor if branch dropdown is empty in live mode.
-- Safe to re-run.

insert into public.flower_branches (id, name, is_active) values
  ('branch-dagupan', 'Dagupan', true),
  ('branch-san-carlos', 'San Carlos', true),
  ('branch-urdaneta', 'Urdaneta', true)
on conflict (id) do update set
  name = excluded.name,
  is_active = excluded.is_active;

alter table public.flower_branches enable row level security;

drop policy if exists "flower_branches_read" on public.flower_branches;

create policy "flower_branches_read"
  on public.flower_branches for select
  to authenticated
  using (public.flower_current_role() in ('staff', 'admin'));

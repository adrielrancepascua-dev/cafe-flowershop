-- Staff management: branch assignment, onboarding, admin team controls
-- Run after schema_flowers_v2.sql

alter table public.flower_profiles
  add column if not exists branch_id text references public.flower_branches(id),
  add column if not exists onboarding_completed boolean not null default true,
  add column if not exists is_active boolean not null default true;

-- Existing accounts are already set up
update public.flower_profiles
set onboarding_completed = true
where onboarding_completed is distinct from true;

create policy "flower_profiles_update_own"
  on public.flower_profiles for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.flower_profiles p where p.id = auth.uid())
    and is_active = (select p.is_active from public.flower_profiles p where p.id = auth.uid())
  );

create policy "flower_profiles_update_admin"
  on public.flower_profiles for update
  to authenticated
  using (public.flower_current_role() = 'admin')
  with check (public.flower_current_role() = 'admin');

-- Staff completes first-login setup (branch + mark onboarded)
create or replace function public.complete_staff_onboarding(p_branch_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.flower_current_role() is distinct from 'staff' then
    raise exception 'Only staff accounts can complete onboarding.';
  end if;

  if p_branch_id is null or length(trim(p_branch_id)) = 0 then
    raise exception 'Branch is required.';
  end if;

  if not exists (
    select 1 from public.flower_branches b
    where b.id = p_branch_id and b.is_active = true
  ) then
    raise exception 'Invalid branch.';
  end if;

  update public.flower_profiles
  set
    branch_id = p_branch_id,
    onboarding_completed = true
  where id = auth.uid()
    and onboarding_completed = false;
end;
$$;

grant execute on function public.complete_staff_onboarding(text) to authenticated;

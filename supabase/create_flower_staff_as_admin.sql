-- Create and delete staff logins as the signed-in admin or co-admin.
-- The Team API used the service-role key to re-check the caller. When that
-- key does not match this project, both admin and co-admin get
-- "Admin access required." even though their own session can read flower_profiles.
-- These functions run as the caller (auth.uid()) and do not need the service role.

create or replace function public.create_flower_staff(p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_name text;
  v_slug text;
  v_email text;
  v_id uuid;
  v_attempt integer;
  v_domain text := 'papersandpetals.ph';
begin
  if auth.uid() is null then
    raise exception 'You must be signed in as admin.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.flower_profiles
    where id = auth.uid()
      and role in ('admin', 'co_admin')
      and coalesce(is_active, false)
  ) then
    raise exception 'Admin access required.'
      using errcode = '42501';
  end if;

  v_name := trim(coalesce(p_display_name, ''));
  if v_name = '' then
    raise exception 'Display name is required.';
  end if;

  v_slug := lower(v_name);
  v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '.', 'g');
  v_slug := trim(both '.' from v_slug);
  v_slug := left(v_slug, 28);
  if v_slug = '' then
    v_slug := 'staff';
  end if;

  for v_attempt in 1..5 loop
    v_email := v_slug || '.' || substr(md5(random()::text || clock_timestamp()::text), 1, 4) || '@' || v_domain;

    begin
      v_id := gen_random_uuid();

      insert into auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        email_change_token_current,
        phone_change,
        phone_change_token,
        reauthentication_token,
        is_sso_user,
        is_anonymous,
        email_change_confirm_status
      ) values (
        '00000000-0000-0000-0000-000000000000',
        v_id,
        'authenticated',
        'authenticated',
        v_email,
        crypt('1234', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('display_name', v_name, 'email_verified', true),
        now(),
        now(),
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        false,
        false,
        0
      );

      insert into auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        created_at,
        updated_at,
        last_sign_in_at
      ) values (
        gen_random_uuid(),
        v_id,
        v_id::text,
        jsonb_build_object(
          'sub', v_id::text,
          'email', v_email,
          'email_verified', true,
          'phone_verified', false
        ),
        'email',
        now(),
        now(),
        now()
      );

      insert into public.flower_profiles (
        id,
        email,
        display_name,
        role,
        branch_id,
        onboarding_completed,
        is_active
      ) values (
        v_id,
        v_email,
        v_name,
        'staff',
        null,
        false,
        true
      );

      return jsonb_build_object(
        'id', v_id,
        'email', v_email,
        'display_name', v_name,
        'role', 'staff',
        'temporary_password', '1234',
        'onboarding_completed', false
      );
    exception
      when unique_violation then
        null;
    end;
  end loop;

  raise exception 'Could not create staff account.';
end;
$$;

create or replace function public.delete_flower_staff(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in as admin.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.flower_profiles
    where id = auth.uid()
      and role in ('admin', 'co_admin')
      and coalesce(is_active, false)
  ) then
    raise exception 'Admin access required.'
      using errcode = '42501';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot delete your own account.';
  end if;

  select role into v_role
  from public.flower_profiles
  where id = p_user_id;

  if v_role is null then
    raise exception 'User not found.';
  end if;

  if v_role <> 'staff' then
    raise exception 'Only staff accounts can be deleted.';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.create_flower_staff(text) from public;
revoke all on function public.delete_flower_staff(uuid) from public;
grant execute on function public.create_flower_staff(text) to authenticated;
grant execute on function public.delete_flower_staff(uuid) to authenticated;

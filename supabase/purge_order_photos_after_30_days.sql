-- Drop photos for orders whose pickup month is already over.
-- A July reservation for November stays until December. Order rows stay.
-- The Storage API must delete the files. These functions only list them and
-- mark the order columns so the app does not keep pointing at a missing file.

create or replace function public.order_photo_url_matches_path(p_url text, p_paths text[])
returns boolean
language sql
immutable
as $$
  select coalesce(p_url, '') like 'http%'
    and exists (
      select 1
      from unnest(coalesce(p_paths, array[]::text[])) as path
      where path <> ''
        and p_url like '%/' || replace(replace(replace(path, '\', '\\'), '%', '\%'), '_', '\_') escape '\'
    );
$$;

drop function if exists public.list_expired_order_attachment_paths(integer);

create or replace function public.list_expired_order_attachment_paths(p_limit integer default 200)
returns table(object_name text, created_at timestamptz, scheduled_for timestamptz)
language sql
stable
security definer
set search_path = public, storage
as $$
  select o.name, o.created_at, fo.scheduled_for
  from storage.objects o
  left join public.flower_orders fo
    on split_part(o.name, '/', 1) = fo.id
  where o.bucket_id = 'order-attachments'
    and (
      (
        fo.id is not null
        and (fo.scheduled_for at time zone 'Asia/Manila')
          < date_trunc('month', now() at time zone 'Asia/Manila')
      )
      or (
        fo.id is null
        and (o.created_at at time zone 'Asia/Manila')
          < date_trunc('month', now() at time zone 'Asia/Manila')
      )
    )
  order by o.created_at
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
$$;

create or replace function public.mark_order_photos_removed(p_paths text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.flower_orders o
  set
    photo_inspo_data_url = case
      when public.order_photo_url_matches_path(o.photo_inspo_data_url, p_paths) then 'expired'
      else o.photo_inspo_data_url
    end,
    proof_dp_data_url = case
      when public.order_photo_url_matches_path(o.proof_dp_data_url, p_paths) then 'expired'
      else o.proof_dp_data_url
    end,
    order_form_ss_data_url = case
      when public.order_photo_url_matches_path(o.order_form_ss_data_url, p_paths) then 'expired'
      else o.order_form_ss_data_url
    end,
    ready_photo_data_url = case
      when public.order_photo_url_matches_path(o.ready_photo_data_url, p_paths) then 'expired'
      else o.ready_photo_data_url
    end,
    proof_balance_data_url = case
      when public.order_photo_url_matches_path(o.proof_balance_data_url, p_paths) then 'expired'
      else o.proof_balance_data_url
    end
  where public.order_photo_url_matches_path(o.photo_inspo_data_url, p_paths)
     or public.order_photo_url_matches_path(o.proof_dp_data_url, p_paths)
     or public.order_photo_url_matches_path(o.order_form_ss_data_url, p_paths)
     or public.order_photo_url_matches_path(o.ready_photo_data_url, p_paths)
     or public.order_photo_url_matches_path(o.proof_balance_data_url, p_paths);

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.order_photo_url_matches_path(text, text[]) from public;
revoke all on function public.list_expired_order_attachment_paths(integer) from public;
revoke all on function public.mark_order_photos_removed(text[]) from public;

grant execute on function public.list_expired_order_attachment_paths(integer) to service_role;
grant execute on function public.mark_order_photos_removed(text[]) to service_role;

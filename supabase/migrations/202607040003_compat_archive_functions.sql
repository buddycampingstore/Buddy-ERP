alter table public.brands
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid;

alter table public.models
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid;

alter table public.variants
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid;

create or replace function public.archive_brand(p_brand_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_store_user() then
    raise exception 'Authentication required';
  end if;

  update public.variants v
  set is_active = false,
      archived_at = coalesce(archived_at, now()),
      archived_by = coalesce(archived_by, auth.uid())
  from public.models m
  where v.model_id = m.id
    and m.brand_id = p_brand_id;

  update public.models
  set is_active = false,
      archived_at = coalesce(archived_at, now()),
      archived_by = coalesce(archived_by, auth.uid())
  where brand_id = p_brand_id;

  update public.brands
  set is_active = false,
      archived_at = coalesce(archived_at, now()),
      archived_by = coalesce(archived_by, auth.uid())
  where id = p_brand_id;
end;
$$;

create or replace function public.archive_model(p_model_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_store_user() then
    raise exception 'Authentication required';
  end if;

  update public.variants
  set is_active = false,
      archived_at = coalesce(archived_at, now()),
      archived_by = coalesce(archived_by, auth.uid())
  where model_id = p_model_id;

  update public.models
  set is_active = false,
      archived_at = coalesce(archived_at, now()),
      archived_by = coalesce(archived_by, auth.uid())
  where id = p_model_id;
end;
$$;

create or replace function public.archive_variant(p_variant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_store_user() then
    raise exception 'Authentication required';
  end if;

  update public.variants
  set is_active = false,
      archived_at = coalesce(archived_at, now()),
      archived_by = coalesce(archived_by, auth.uid())
  where id = p_variant_id;
end;
$$;

grant execute on function public.archive_brand(uuid) to authenticated;
grant execute on function public.archive_model(uuid) to authenticated;
grant execute on function public.archive_variant(uuid) to authenticated;

-- "ซ่อน" (archive) buttons implied reversibility but there was no way to view
-- or restore hidden brands/models/variants — hiding something was effectively
-- permanent deletion from the user's point of view. This adds:
--   1) get_archived_products(): fetch only archived rows (mirrors
--      get_products_payload's shape, which now excludes them).
--   2) restore_brand/model/variant(): undo an archive.
--
-- Archiving cascades DOWN (archiving a brand hides its models and variants).
-- Restoring mirrors that but also cascades UP for variant/model restores —
-- otherwise restoring a variant whose parent model/brand is still archived
-- would leave it invisible in the grouped product UI, defeating the point of
-- "restore".

create or replace function public.get_archived_products()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_store_user() then
    raise exception 'Authentication required';
  end if;

  select jsonb_build_object(
    'brands', coalesce((
      select jsonb_agg(to_jsonb(b) order by b.archived_at desc nulls last, b.name)
      from (
        select id, name, is_active, archived_at
        from public.brands
        where is_active = false
      ) b
    ), '[]'::jsonb),
    'models', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.archived_at desc nulls last, m.name)
      from (
        select
          id, brand_id, name,
          case when image like 'data:%' then null else image end as image,
          is_active, archived_at
        from public.models
        where is_active = false
      ) m
    ), '[]'::jsonb),
    'variants', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.archived_at desc nulls last, v.color)
      from (
        select
          id, model_id, color,
          case when image like 'data:%' then null else image end as image,
          qty_in_stock, current_wac, standard_sale_price,
          is_active, archived_at
        from public.variants
        where is_active = false
      ) v
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.restore_variant(p_variant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_model_id uuid;
  v_brand_id uuid;
begin
  if not public.is_store_user() then
    raise exception 'Authentication required';
  end if;

  update public.variants
  set is_active = true,
      archived_at = null,
      archived_by = null
  where id = p_variant_id
  returning model_id into v_model_id;

  if v_model_id is null then
    raise exception 'Variant not found: %', p_variant_id;
  end if;

  select brand_id into v_brand_id from public.models where id = v_model_id;

  update public.models
  set is_active = true,
      archived_at = null,
      archived_by = null
  where id = v_model_id
    and is_active = false;

  update public.brands
  set is_active = true,
      archived_at = null,
      archived_by = null
  where id = v_brand_id
    and is_active = false;
end;
$$;

create or replace function public.restore_model(p_model_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
begin
  if not public.is_store_user() then
    raise exception 'Authentication required';
  end if;

  update public.models
  set is_active = true,
      archived_at = null,
      archived_by = null
  where id = p_model_id
  returning brand_id into v_brand_id;

  if v_brand_id is null then
    raise exception 'Model not found: %', p_model_id;
  end if;

  update public.brands
  set is_active = true,
      archived_at = null,
      archived_by = null
  where id = v_brand_id
    and is_active = false;

  -- archive_model cascades to its variants, so restore mirrors that.
  update public.variants
  set is_active = true,
      archived_at = null,
      archived_by = null
  where model_id = p_model_id;
end;
$$;

create or replace function public.restore_brand(p_brand_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_store_user() then
    raise exception 'Authentication required';
  end if;

  if not exists (select 1 from public.brands where id = p_brand_id) then
    raise exception 'Brand not found: %', p_brand_id;
  end if;

  update public.brands
  set is_active = true,
      archived_at = null,
      archived_by = null
  where id = p_brand_id;

  -- archive_brand cascades to its models and variants, so restore mirrors that.
  update public.models
  set is_active = true,
      archived_at = null,
      archived_by = null
  where brand_id = p_brand_id;

  update public.variants v
  set is_active = true,
      archived_at = null,
      archived_by = null
  from public.models m
  where v.model_id = m.id
    and m.brand_id = p_brand_id;
end;
$$;

grant execute on function public.get_archived_products() to authenticated;
grant execute on function public.restore_variant(uuid) to authenticated;
grant execute on function public.restore_model(uuid) to authenticated;
grant execute on function public.restore_brand(uuid) to authenticated;

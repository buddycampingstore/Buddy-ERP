-- Exclude inline base64 images from get_products_payload.
--
-- Diagnosis (2026-07-08): variants weighed 29 MB and models 12 MB for only
-- 39/23 rows because ~34 images were pasted into the image column as
-- data: URIs instead of uploaded to Storage. The payload therefore built a
-- ~38 MB jsonb on every load, hitting the statement timeout and making the
-- app crawl. Until those rows are migrated to Storage URLs (see
-- scripts/migrate-images-to-storage.mjs), replace any data: URI with null so
-- the payload stays small; http(s) URLs pass through unchanged.

create or replace function public.get_products_payload()
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
      select jsonb_agg(to_jsonb(b) order by b.name)
      from (
        select id, name, is_active, archived_at
        from public.brands
        where is_active is distinct from false
      ) b
    ), '[]'::jsonb),
    'models', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.name)
      from (
        select
          id,
          brand_id,
          name,
          case when image like 'data:%' then null else image end as image,
          is_active,
          archived_at
        from public.models
        where is_active is distinct from false
      ) m
    ), '[]'::jsonb),
    'variants', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.color)
      from (
        select
          id,
          model_id,
          color,
          case when image like 'data:%' then null else image end as image,
          qty_in_stock,
          current_wac,
          standard_sale_price,
          is_active,
          archived_at
        from public.variants
        where is_active is distinct from false
      ) v
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_products_payload() to authenticated;

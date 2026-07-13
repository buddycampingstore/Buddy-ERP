-- Add a nullable specs/description column to models.
--
-- The public storefront (/shop) shows this as "สเปค / รายละเอียดสินค้า"; the
-- ERP model dialog (ProductsView.tsx) edits it. Nullable because every existing
-- model predates this column and the field is optional in the UI.
--
-- Note: public.restore_backup(jsonb) (202607030001) re-inserts models without
-- this column, so a backup restore would drop descriptions. No client code
-- calls restore_backup, so it is intentionally left unchanged here rather than
-- expanding this migration's scope.

alter table public.models
  add column if not exists description text;

-- Recreate get_products_payload so the ERP receives `description`. Body is
-- identical to 202607080002_products_payload_exclude_inline_images.sql except
-- the models subquery adds `description`. data: URI stripping, active-only
-- filters, and the variants payload (including current_wac) are unchanged.
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
          description,
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

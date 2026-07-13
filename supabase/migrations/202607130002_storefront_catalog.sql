-- Public read-only catalog for the storefront page (/shop).
--
-- SECURITY NOTE: this function is `security definer` (it bypasses RLS) and is
-- granted to `anon`, so anyone on the internet can call it without logging in.
-- The security boundary is therefore the explicit column list below — NOT an
-- auth guard. NEVER add current_wac, cost, profit, order, customer, purchase,
-- or stock_items fields here. Columns are listed explicitly (no `select *`) so
-- that a future column added to brands/models/variants is not exposed
-- automatically. Unlike get_products_payload this has no is_store_user() guard;
-- that is intentional and is what makes the catalog public.
--
-- Depends on models.description (added in 202607130001) — run that first.

create or replace function public.get_storefront_catalog()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'brands', coalesce((
      select jsonb_agg(to_jsonb(b) order by b.name)
      from (
        select id, name
        from public.brands
        where is_active is distinct from false
      ) b
    ), '[]'::jsonb),
    'models', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.name)
      from (
        select
          mo.id,
          mo.brand_id,
          mo.name,
          mo.description,
          case when mo.image like 'data:%' then null else mo.image end as image
        from public.models mo
        join public.brands br on br.id = mo.brand_id
        where mo.is_active is distinct from false
          and br.is_active is distinct from false
      ) m
    ), '[]'::jsonb),
    'variants', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.color)
      from (
        select
          va.id,
          va.model_id,
          va.color,
          case when va.image like 'data:%' then null else va.image end as image,
          va.qty_in_stock,
          va.standard_sale_price
        from public.variants va
        join public.models mo on mo.id = va.model_id
        join public.brands br on br.id = mo.brand_id
        where va.is_active is distinct from false
          and mo.is_active is distinct from false
          and br.is_active is distinct from false
      ) v
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_storefront_catalog() to anon, authenticated;

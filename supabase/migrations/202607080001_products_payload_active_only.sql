-- Redefine get_products_payload to return only active (non-archived) rows.
--
-- Previously this RPC shipped every brand/model/variant row — including
-- archived ones — and the client filtered them out with `is_active !== false`.
-- On a store with many archived variants the payload grew unbounded and was
-- refetched on every product/order/purchase mutation. We now filter server-side
-- with `is_active is distinct from false` (keeps true and NULL, drops false),
-- which exactly matches the client's `is_active !== false` predicate.

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
        select id, brand_id, name, image, is_active, archived_at
        from public.models
        where is_active is distinct from false
      ) m
    ), '[]'::jsonb),
    'variants', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.color)
      from (
        select id, model_id, color, image, qty_in_stock, current_wac, standard_sale_price, is_active, archived_at
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

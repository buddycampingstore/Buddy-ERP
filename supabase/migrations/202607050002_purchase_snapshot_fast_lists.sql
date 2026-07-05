alter table public.purchase_batch_items
  add column if not exists brand_name_snapshot text not null default '',
  add column if not exists model_name_snapshot text not null default '',
  add column if not exists variant_color_snapshot text not null default '';

update public.purchase_batch_items pbi
set brand_name_snapshot = coalesce(nullif(pbi.brand_name_snapshot, ''), b.name, ''),
    model_name_snapshot = coalesce(nullif(pbi.model_name_snapshot, ''), m.name, ''),
    variant_color_snapshot = coalesce(nullif(pbi.variant_color_snapshot, ''), v.color, '')
from public.variants v
left join public.models m on m.id = v.model_id
left join public.brands b on b.id = m.brand_id
where pbi.variant_id = v.id
  and (
    pbi.brand_name_snapshot = ''
    or pbi.model_name_snapshot = ''
    or pbi.variant_color_snapshot = ''
  );

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
      ) b
    ), '[]'::jsonb),
    'models', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.name)
      from (
        select id, brand_id, name, image, is_active, archived_at
        from public.models
      ) m
    ), '[]'::jsonb),
    'variants', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.color)
      from (
        select id, model_id, color, image, qty_in_stock, current_wac, standard_sale_price, is_active, archived_at
        from public.variants
      ) v
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.get_purchase_page(
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if not public.is_store_user() then
    raise exception 'Authentication required';
  end if;

  with paged_batches as (
    select
      pb.*,
      count(*) over() as total_count
    from public.purchase_batches pb
    order by pb.date desc, pb.id desc
    limit v_limit
    offset v_offset
  ),
  items_by_batch as (
    select
      pbi.batch_id,
      jsonb_agg(
        jsonb_build_object(
          'batch_id', pbi.batch_id,
          'variant_id', pbi.variant_id,
          'qty', pbi.qty,
          'unit_price', pbi.unit_price,
          'brand_name_snapshot', pbi.brand_name_snapshot,
          'model_name_snapshot', pbi.model_name_snapshot,
          'variant_color_snapshot', pbi.variant_color_snapshot
        )
        order by pbi.created_at, pbi.id
      ) as items
    from public.purchase_batch_items pbi
    where pbi.batch_id in (select id from paged_batches)
    group by pbi.batch_id
  )
  select jsonb_build_object(
    'purchase_batches', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', pb.id,
          'date', pb.date,
          'shipping_cost', pb.shipping_cost,
          'other_cost', pb.other_cost,
          'note', pb.note,
          'items', coalesce(items.items, '[]'::jsonb)
        )
        order by pb.date desc, pb.id desc
      )
      from paged_batches pb
      left join items_by_batch items on items.batch_id = pb.id
    ), '[]'::jsonb),
    'total_count', coalesce((select max(total_count) from paged_batches), 0)
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.add_purchase_batch(
  p_date date,
  p_shipping_cost numeric,
  p_other_cost numeric,
  p_items jsonb,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_total_qty integer;
  v_overhead_per_unit numeric;
  v_item jsonb;
  v_variant_id uuid;
  v_qty integer;
  v_unit_price numeric;
  v_old_qty integer;
  v_old_wac numeric;
  v_new_cost numeric;
  v_new_wac numeric;
begin
  if not public.is_store_user() then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Purchase batch must contain at least one item';
  end if;

  if coalesce(p_shipping_cost, 0) < 0 or coalesce(p_other_cost, 0) < 0 then
    raise exception 'Purchase costs cannot be negative';
  end if;

  select coalesce(sum((item->>'qty')::integer), 0)
  into v_total_qty
  from jsonb_array_elements(p_items) item;

  if v_total_qty <= 0 then
    raise exception 'Purchase batch must contain at least one item';
  end if;

  v_overhead_per_unit := (coalesce(p_shipping_cost, 0) + coalesce(p_other_cost, 0)) / v_total_qty;

  insert into public.purchase_batches(date, shipping_cost, other_cost, note)
  values (p_date, coalesce(p_shipping_cost, 0), coalesce(p_other_cost, 0), nullif(p_note, ''))
  returning id into v_batch_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'qty')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;

    if v_qty <= 0 or v_unit_price < 0 then
      raise exception 'Invalid purchase item';
    end if;

    select qty_in_stock, current_wac
    into v_old_qty, v_old_wac
    from public.variants
    where id = v_variant_id
      and is_active = true
    for update;

    if not found then
      raise exception 'Active variant not found: %', v_variant_id;
    end if;

    v_new_cost := v_unit_price + v_overhead_per_unit;
    v_new_wac := round(((v_old_qty * v_old_wac) + (v_qty * v_new_cost)) / (v_old_qty + v_qty), 2);

    insert into public.purchase_batch_items(
      batch_id,
      variant_id,
      qty,
      unit_price,
      brand_name_snapshot,
      model_name_snapshot,
      variant_color_snapshot
    )
    select
      v_batch_id,
      v_variant_id,
      v_qty,
      v_unit_price,
      coalesce(b.name, ''),
      coalesce(m.name, ''),
      coalesce(v.color, '')
    from public.variants v
    left join public.models m on m.id = v.model_id
    left join public.brands b on b.id = m.brand_id
    where v.id = v_variant_id;

    insert into public.stock_items(variant_id, wac_cost, status, batch_id)
    select v_variant_id, v_new_wac, 'in_stock', v_batch_id
    from generate_series(1, v_qty);

    update public.variants
    set current_wac = v_new_wac,
        qty_in_stock = v_old_qty + v_qty
    where id = v_variant_id;
  end loop;

  return v_batch_id::text;
end;
$$;

grant execute on function public.get_products_payload() to authenticated;
grant execute on function public.get_purchase_page(integer, integer) to authenticated;
grant execute on function public.add_purchase_batch(date, numeric, numeric, jsonb, text) to authenticated;

create index if not exists stock_items_in_stock_fifo_idx
  on public.stock_items(variant_id, created_at, id)
  where status = 'in_stock';

create index if not exists stock_items_order_id_idx
  on public.stock_items(order_id);

create index if not exists orders_date_id_idx
  on public.orders(date desc, id desc);

create index if not exists purchase_batches_date_id_idx
  on public.purchase_batches(date desc, id desc);

create or replace function public.get_stock_summary()
returns table (
  variant_id uuid,
  in_stock_qty integer,
  in_stock_value numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_store_user() then
    raise exception 'Authentication required';
  end if;

  return query
  select
    v.id as variant_id,
    count(s.id)::integer as in_stock_qty,
    coalesce(sum(s.wac_cost), 0)::numeric as in_stock_value
  from public.variants v
  left join public.stock_items s
    on s.variant_id = v.id
   and s.status = 'in_stock'
  group by v.id;
end;
$$;

create or replace function public.create_order(p_order jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_variant_id uuid;
  v_qty integer;
  v_sale_price numeric;
  v_discount numeric;
  v_taken_count integer;
  v_final_price numeric;
  v_status text;
  v_delivery_type text;
  v_channel text;
  v_order_discount numeric;
  v_shipping_fee numeric;
  v_shipping_cost numeric;
  v_order_subtotal numeric := 0;
  v_customer_id uuid;
  v_customer_name text;
  v_brand_name text;
  v_model_name text;
  v_variant_color text;
begin
  if not public.is_store_user() then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(p_order->'items') <> 'array' or jsonb_array_length(p_order->'items') = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  v_status := coalesce(p_order->>'status', 'confirmed');
  v_delivery_type := coalesce(p_order->>'delivery_type', 'shipping');
  v_channel := coalesce(p_order->>'channel', 'fb');
  v_order_discount := coalesce((p_order->>'discount')::numeric, 0);
  v_shipping_fee := coalesce((p_order->>'shipping_fee')::numeric, 0);
  v_shipping_cost := coalesce((p_order->>'shipping_cost')::numeric, 0);

  if v_order_discount < 0 or v_shipping_fee < 0 or v_shipping_cost < 0 then
    raise exception 'Order totals cannot be negative';
  end if;

  if nullif(p_order->>'customer_id', '') is not null and p_order->>'customer_id' <> 'general' then
    v_customer_id := (p_order->>'customer_id')::uuid;
    select name into v_customer_name
    from public.customers
    where id = v_customer_id;

    if not found then
      raise exception 'Customer not found: %', v_customer_id;
    end if;
  else
    v_customer_id := null;
    v_customer_name := coalesce(nullif(p_order->>'customer_name_snapshot', ''), 'ลูกค้าทั่วไป');
  end if;

  insert into public.orders(customer_id, customer_name_snapshot, date, channel, status, delivery_type, discount, shipping_fee, shipping_cost)
  values (
    v_customer_id,
    v_customer_name,
    (p_order->>'date')::date,
    v_channel,
    v_status,
    v_delivery_type,
    v_order_discount,
    v_shipping_fee,
    v_shipping_cost
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_order->'items')
  loop
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'qty')::integer;
    v_sale_price := (v_item->>'sale_price')::numeric;
    v_discount := coalesce((v_item->>'discount')::numeric, 0);

    if v_qty <= 0 or v_sale_price < 0 or v_discount < 0 or v_discount > v_sale_price then
      raise exception 'Invalid order item';
    end if;

    v_final_price := v_sale_price - v_discount;
    if v_final_price < 0 then
      raise exception 'Order item total cannot be negative';
    end if;

    select b.name, m.name, v.color
    into v_brand_name, v_model_name, v_variant_color
    from public.variants v
    join public.models m on m.id = v.model_id
    join public.brands b on b.id = m.brand_id
    where v.id = v_variant_id
      and v.is_active = true
      and m.is_active = true
      and b.is_active = true;

    if not found then
      raise exception 'Active variant not found: %', v_variant_id;
    end if;

    with selected_stock as materialized (
      select id, wac_cost
      from public.stock_items
      where variant_id = v_variant_id
        and status = 'in_stock'
      order by created_at, id
      limit v_qty
      for update skip locked
    ),
    sold_stock as (
      update public.stock_items s
      set status = 'sold',
          order_id = v_order_id
      from selected_stock selected
      where s.id = selected.id
      returning s.id, selected.wac_cost
    )
    insert into public.order_items(
      order_id,
      stock_item_id,
      variant_id,
      sale_price,
      discount,
      final_price,
      wac_at_sale,
      profit,
      brand_name_snapshot,
      model_name_snapshot,
      variant_color_snapshot
    )
    select
      v_order_id,
      sold_stock.id,
      v_variant_id,
      v_sale_price,
      v_discount,
      v_final_price,
      sold_stock.wac_cost,
      round(v_final_price - sold_stock.wac_cost, 2),
      v_brand_name,
      v_model_name,
      v_variant_color
    from sold_stock;

    get diagnostics v_taken_count = row_count;

    if v_taken_count < v_qty then
      raise exception 'สินค้าในสต็อกไม่เพียงพอสำหรับรายการนี้';
    end if;

    update public.variants
    set qty_in_stock = greatest(qty_in_stock - v_taken_count, 0)
    where id = v_variant_id;

    v_order_subtotal := v_order_subtotal + (v_final_price * v_taken_count);
  end loop;

  if (v_order_subtotal + v_shipping_fee - v_order_discount) < 0 then
    raise exception 'Order total cannot be negative';
  end if;

  insert into public.deliveries(order_id, tracking, pickup_datetime, status)
  values (v_order_id, '', '', public.delivery_status_from_order(v_status));

  return v_order_id::text;
end;
$$;

grant execute on function public.get_stock_summary() to authenticated;
grant execute on function public.create_order(jsonb) to authenticated;

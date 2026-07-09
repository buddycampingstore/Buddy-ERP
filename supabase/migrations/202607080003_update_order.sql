-- Add public.update_order(p_order_id, p_order): edit an existing order in place.
--
-- Until now a typo in an order could only be fixed by deleting the whole bill
-- and re-keying it. This RPC edits an order atomically by (1) returning the
-- order's currently-consumed stock to inventory, (2) clearing its old line
-- items, (3) updating the order header, then (4) re-consuming stock FIFO for
-- the new items exactly like create_order. Stock counts are re-synced from the
-- stock_items source of truth (via sync_variant_stock) for every variant that
-- was touched by either the old or the new item list, so qty_in_stock and WAC
-- snapshots stay correct. Everything runs in one transaction: any failure
-- (e.g. insufficient stock for the new quantities) rolls the whole edit back.
--
-- Delivery tracking / pickup are preserved; only the derived delivery status is
-- re-synced from the (possibly changed) order status.

create or replace function public.update_order(p_order_id uuid, p_order jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
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
  v_affected_variants uuid[];
begin
  if not public.is_store_user() then
    raise exception 'Authentication required';
  end if;

  if not exists (select 1 from public.orders where id = p_order_id) then
    raise exception 'Order not found: %', p_order_id;
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

  -- Remember which variants the OLD items touched so we can re-sync them even
  -- if the new item list no longer references them.
  select coalesce(array_agg(distinct variant_id), '{}')
  into v_affected_variants
  from public.order_items
  where order_id = p_order_id;

  -- 1) Return the order's consumed stock to inventory, 2) drop old line items.
  update public.stock_items
  set status = 'in_stock',
      order_id = null
  where order_id = p_order_id;

  delete from public.order_items
  where order_id = p_order_id;

  -- 3) Update the order header.
  update public.orders
  set customer_id = v_customer_id,
      customer_name_snapshot = v_customer_name,
      date = (p_order->>'date')::date,
      channel = v_channel,
      status = v_status,
      delivery_type = v_delivery_type,
      discount = v_order_discount,
      shipping_fee = v_shipping_fee,
      shipping_cost = v_shipping_cost
  where id = p_order_id;

  -- 4) Re-consume stock FIFO for the new items (mirrors create_order).
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

    v_affected_variants := array_append(v_affected_variants, v_variant_id);

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
          order_id = p_order_id
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
      p_order_id,
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

    v_order_subtotal := v_order_subtotal + (v_final_price * v_taken_count);
  end loop;

  if (v_order_subtotal + v_shipping_fee - v_order_discount) < 0 then
    raise exception 'Order total cannot be negative';
  end if;

  -- Re-sync qty_in_stock from the stock_items source of truth for every
  -- variant touched by the old or new item lists.
  for v_variant_id in select distinct unnest(v_affected_variants)
  loop
    perform public.sync_variant_stock(v_variant_id);
  end loop;

  -- Keep delivery tracking/pickup; only re-derive the delivery status.
  update public.deliveries
  set status = public.delivery_status_from_order(v_status)
  where order_id = p_order_id;

  return p_order_id::text;
end;
$$;

grant execute on function public.update_order(uuid, jsonb) to authenticated;

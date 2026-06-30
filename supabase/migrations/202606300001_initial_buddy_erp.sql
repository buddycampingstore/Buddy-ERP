create extension if not exists pgcrypto;

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  image text,
  created_at timestamptz not null default now()
);

create table if not exists public.variants (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete cascade,
  color text not null,
  qty_in_stock integer not null default 0,
  current_wac numeric(12,2) not null default 0,
  standard_sale_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint variants_qty_nonnegative check (qty_in_stock >= 0),
  constraint variants_wac_nonnegative check (current_wac >= 0),
  constraint variants_sale_price_nonnegative check (standard_sale_price >= 0)
);

create table if not exists public.purchase_batches (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  shipping_cost numeric(12,2) not null default 0,
  other_cost numeric(12,2) not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.purchase_batches(id) on delete cascade,
  variant_id uuid not null references public.variants(id) on delete cascade,
  qty integer not null,
  unit_price numeric(12,2) not null,
  created_at timestamptz not null default now(),
  constraint purchase_batch_items_qty_positive check (qty > 0),
  constraint purchase_batch_items_unit_price_nonnegative check (unit_price >= 0)
);

create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants(id) on delete cascade,
  wac_cost numeric(12,2) not null,
  status text not null default 'in_stock',
  order_id uuid,
  batch_id uuid not null references public.purchase_batches(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint stock_items_status_check check (status in ('in_stock', 'sold')),
  constraint stock_items_wac_nonnegative check (wac_cost >= 0)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  facebook text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null default 'general',
  date date not null,
  channel text not null,
  status text not null,
  delivery_type text not null,
  discount numeric(12,2) not null default 0,
  shipping_fee numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint orders_channel_check check (channel in ('fb', 'ig', 'other')),
  constraint orders_status_check check (status in ('pending', 'confirmed', 'shipped', 'delivered')),
  constraint orders_delivery_type_check check (delivery_type in ('shipping', 'pickup')),
  constraint orders_discount_nonnegative check (discount >= 0),
  constraint orders_shipping_fee_nonnegative check (shipping_fee >= 0),
  constraint orders_shipping_cost_nonnegative check (shipping_cost >= 0)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  stock_item_id uuid not null references public.stock_items(id) on delete cascade,
  variant_id uuid not null references public.variants(id) on delete cascade,
  sale_price numeric(12,2) not null,
  discount numeric(12,2) not null default 0,
  final_price numeric(12,2) not null,
  wac_at_sale numeric(12,2) not null,
  profit numeric(12,2) not null,
  created_at timestamptz not null default now(),
  constraint order_items_stock_item_unique unique (stock_item_id),
  constraint order_items_sale_price_nonnegative check (sale_price >= 0),
  constraint order_items_discount_nonnegative check (discount >= 0)
);

alter table public.stock_items
  add constraint stock_items_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete set null;

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  tracking text not null default '',
  pickup_datetime text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint deliveries_status_check check (status in ('pending', 'dispatched', 'delivered'))
);

create index if not exists models_brand_id_idx on public.models(brand_id);
create index if not exists variants_model_id_idx on public.variants(model_id);
create index if not exists purchase_batch_items_batch_id_idx on public.purchase_batch_items(batch_id);
create index if not exists stock_items_variant_status_idx on public.stock_items(variant_id, status);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists deliveries_order_id_idx on public.deliveries(order_id);

alter table public.brands enable row level security;
alter table public.models enable row level security;
alter table public.variants enable row level security;
alter table public.purchase_batches enable row level security;
alter table public.purchase_batch_items enable row level security;
alter table public.stock_items enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.deliveries enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'brands',
    'models',
    'variants',
    'purchase_batches',
    'purchase_batch_items',
    'stock_items',
    'customers',
    'orders',
    'order_items',
    'deliveries'
  ]
  loop
    execute format('drop policy if exists "%1$s authenticated access" on public.%1$I', table_name);
    execute format(
      'create policy "%1$s authenticated access" on public.%1$I for all to authenticated using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')',
      table_name
    );
  end loop;
end $$;

create or replace function public.sync_variant_stock(p_variant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.variants
  set qty_in_stock = (
    select count(*)::integer
    from public.stock_items
    where variant_id = p_variant_id
      and status = 'in_stock'
  )
  where id = p_variant_id;
end;
$$;

create or replace function public.delivery_status_from_order(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'pending' then 'pending'
    when 'confirmed' then 'pending'
    when 'shipped' then 'dispatched'
    when 'delivered' then 'delivered'
    else 'pending'
  end;
$$;

create or replace function public.order_status_from_delivery(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'pending' then 'confirmed'
    when 'dispatched' then 'shipped'
    when 'delivered' then 'delivered'
    else null
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
  if auth.role() <> 'authenticated' then
    raise exception 'Authentication required';
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
    for update;

    if not found then
      raise exception 'Variant not found: %', v_variant_id;
    end if;

    v_new_cost := v_unit_price + v_overhead_per_unit;
    v_new_wac := round(((v_old_qty * v_old_wac) + (v_qty * v_new_cost)) / (v_old_qty + v_qty), 2);

    insert into public.purchase_batch_items(batch_id, variant_id, qty, unit_price)
    values (v_batch_id, v_variant_id, v_qty, v_unit_price);

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
  v_available_count integer;
  v_taken_count integer;
  v_stock record;
  v_final_price numeric;
  v_profit numeric;
  v_status text;
  v_delivery_type text;
  v_channel text;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Authentication required';
  end if;

  v_status := coalesce(p_order->>'status', 'confirmed');
  v_delivery_type := coalesce(p_order->>'delivery_type', 'shipping');
  v_channel := coalesce(p_order->>'channel', 'fb');

  insert into public.orders(customer_id, date, channel, status, delivery_type, discount, shipping_fee, shipping_cost)
  values (
    coalesce(p_order->>'customer_id', 'general'),
    (p_order->>'date')::date,
    v_channel,
    v_status,
    v_delivery_type,
    coalesce((p_order->>'discount')::numeric, 0),
    coalesce((p_order->>'shipping_fee')::numeric, 0),
    coalesce((p_order->>'shipping_cost')::numeric, 0)
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_order->'items')
  loop
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'qty')::integer;
    v_sale_price := (v_item->>'sale_price')::numeric;
    v_discount := coalesce((v_item->>'discount')::numeric, 0);

    select count(*)::integer
    into v_available_count
    from public.stock_items
    where variant_id = v_variant_id
      and status = 'in_stock';

    if v_available_count < v_qty then
      raise exception 'สินค้าในสต็อกไม่เพียงพอสำหรับทำรายการนี้';
    end if;

    v_taken_count := 0;

    for v_stock in
      select id, wac_cost
      from public.stock_items
      where variant_id = v_variant_id
        and status = 'in_stock'
      order by created_at, id
      limit v_qty
      for update skip locked
    loop
      v_final_price := v_sale_price - v_discount;
      v_profit := round(v_final_price - v_stock.wac_cost, 2);

      update public.stock_items
      set status = 'sold',
          order_id = v_order_id
      where id = v_stock.id;

      insert into public.order_items(
        order_id,
        stock_item_id,
        variant_id,
        sale_price,
        discount,
        final_price,
        wac_at_sale,
        profit
      )
      values (
        v_order_id,
        v_stock.id,
        v_variant_id,
        v_sale_price,
        v_discount,
        v_final_price,
        v_stock.wac_cost,
        v_profit
      );

      v_taken_count := v_taken_count + 1;
    end loop;

    if v_taken_count < v_qty then
      raise exception 'สินค้าในสต็อกไม่เพียงพอสำหรับทำรายการนี้';
    end if;

    perform public.sync_variant_stock(v_variant_id);
  end loop;

  insert into public.deliveries(order_id, tracking, pickup_datetime, status)
  values (v_order_id, '', '', public.delivery_status_from_order(v_status));

  return v_order_id::text;
end;
$$;

create or replace function public.update_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Authentication required';
  end if;

  update public.orders
  set status = p_status
  where id = p_order_id;

  update public.deliveries
  set status = public.delivery_status_from_order(p_status)
  where order_id = p_order_id;
end;
$$;

create or replace function public.update_delivery(p_order_id uuid, p_updates jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery_status text;
  v_order_status text;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Authentication required';
  end if;

  update public.deliveries
  set tracking = coalesce(p_updates->>'tracking', tracking),
      pickup_datetime = coalesce(p_updates->>'pickup_datetime', pickup_datetime),
      status = coalesce(p_updates->>'status', status)
  where order_id = p_order_id
  returning status into v_delivery_status;

  if p_updates ? 'status' then
    v_order_status := public.order_status_from_delivery(v_delivery_status);
    if v_order_status is not null then
      update public.orders
      set status = v_order_status
      where id = p_order_id;
    end if;
  end if;
end;
$$;

create or replace function public.delete_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_variant_id uuid;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Authentication required';
  end if;

  update public.stock_items
  set status = 'in_stock',
      order_id = null
  where order_id = p_order_id;

  for v_variant_id in
    select distinct variant_id
    from public.order_items
    where order_id = p_order_id
  loop
    perform public.sync_variant_stock(v_variant_id);
  end loop;

  delete from public.orders
  where id = p_order_id;
end;
$$;

create or replace function public.clear_store_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Authentication required';
  end if;

  delete from public.deliveries;
  delete from public.order_items;
  delete from public.stock_items;
  delete from public.orders;
  delete from public.purchase_batch_items;
  delete from public.purchase_batches;
  delete from public.customers;
  delete from public.variants;
  delete from public.models;
  delete from public.brands;
end;
$$;

create or replace function public.restore_backup(p_backup jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_batch_item jsonb;
  v_order_doc jsonb;
  v_order_item jsonb;
  v_old_id text;
  v_new_id uuid;
  v_brand_map jsonb := '{}'::jsonb;
  v_model_map jsonb := '{}'::jsonb;
  v_variant_map jsonb := '{}'::jsonb;
  v_batch_map jsonb := '{}'::jsonb;
  v_stock_map jsonb := '{}'::jsonb;
  v_order_map jsonb := '{}'::jsonb;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Authentication required';
  end if;

  perform public.clear_store_data();

  for v_item in select * from jsonb_array_elements(p_backup->'brands')
  loop
    insert into public.brands(name)
    values (v_item->>'name')
    returning id into v_new_id;
    v_brand_map := v_brand_map || jsonb_build_object(v_item->>'id', v_new_id::text);
  end loop;

  for v_item in select * from jsonb_array_elements(p_backup->'models')
  loop
    insert into public.models(brand_id, name, image)
    values ((v_brand_map->>(v_item->>'brand_id'))::uuid, v_item->>'name', nullif(v_item->>'image', ''))
    returning id into v_new_id;
    v_model_map := v_model_map || jsonb_build_object(v_item->>'id', v_new_id::text);
  end loop;

  for v_item in select * from jsonb_array_elements(p_backup->'variants')
  loop
    insert into public.variants(model_id, color, qty_in_stock, current_wac, standard_sale_price)
    values (
      (v_model_map->>(v_item->>'model_id'))::uuid,
      v_item->>'color',
      coalesce((v_item->>'qty_in_stock')::integer, 0),
      coalesce((v_item->>'current_wac')::numeric, 0),
      coalesce((v_item->>'standard_sale_price')::numeric, 0)
    )
    returning id into v_new_id;
    v_variant_map := v_variant_map || jsonb_build_object(v_item->>'id', v_new_id::text);
  end loop;

  for v_item in select * from jsonb_array_elements(p_backup->'purchaseBatches')
  loop
    insert into public.purchase_batches(date, shipping_cost, other_cost, note)
    values (
      (v_item->>'date')::date,
      coalesce((v_item->>'shipping_cost')::numeric, 0),
      coalesce((v_item->>'other_cost')::numeric, 0),
      nullif(v_item->>'note', '')
    )
    returning id into v_new_id;
    v_batch_map := v_batch_map || jsonb_build_object(v_item->>'id', v_new_id::text);

    for v_batch_item in select * from jsonb_array_elements(v_item->'items')
    loop
      insert into public.purchase_batch_items(batch_id, variant_id, qty, unit_price)
      values (
        v_new_id,
        (v_variant_map->>(v_batch_item->>'variant_id'))::uuid,
        (v_batch_item->>'qty')::integer,
        (v_batch_item->>'unit_price')::numeric
      );
    end loop;
  end loop;

  for v_item in select * from jsonb_array_elements(p_backup->'customers')
  loop
    insert into public.customers(name, phone, facebook, note)
    values (
      v_item->>'name',
      coalesce(v_item->>'phone', ''),
      coalesce(v_item->>'facebook', ''),
      coalesce(v_item->>'note', '')
    );
  end loop;

  for v_item in select * from jsonb_array_elements(p_backup->'orders')
  loop
    v_old_id := v_item->>'id';
    insert into public.orders(customer_id, date, channel, status, delivery_type, discount, shipping_fee, shipping_cost)
    values (
      coalesce(v_item->>'customer_id', 'general'),
      (v_item->>'date')::date,
      v_item->>'channel',
      v_item->>'status',
      v_item->>'delivery_type',
      coalesce((v_item->>'discount')::numeric, 0),
      coalesce((v_item->>'shipping_fee')::numeric, 0),
      coalesce((v_item->>'shipping_cost')::numeric, 0)
    )
    returning id into v_new_id;
    v_order_map := v_order_map || jsonb_build_object(v_old_id, v_new_id::text);
  end loop;

  for v_item in select * from jsonb_array_elements(p_backup->'stockItems')
  loop
    insert into public.stock_items(variant_id, wac_cost, status, order_id, batch_id)
    values (
      (v_variant_map->>(v_item->>'variant_id'))::uuid,
      (v_item->>'wac_cost')::numeric,
      v_item->>'status',
      case when v_item ? 'order_id' and nullif(v_item->>'order_id', '') is not null
        then (v_order_map->>(v_item->>'order_id'))::uuid
        else null
      end,
      (v_batch_map->>(v_item->>'batch_id'))::uuid
    )
    returning id into v_new_id;
    v_stock_map := v_stock_map || jsonb_build_object(v_item->>'id', v_new_id::text);
  end loop;

  for v_order_doc in select * from jsonb_array_elements(p_backup->'orders')
  loop
    for v_order_item in select * from jsonb_array_elements(v_order_doc->'items')
    loop
      insert into public.order_items(order_id, stock_item_id, variant_id, sale_price, discount, final_price, wac_at_sale, profit)
      values (
        (v_order_map->>(v_order_doc->>'id'))::uuid,
        (v_stock_map->>(v_order_item->>'stock_item_id'))::uuid,
        (v_variant_map->>(v_order_item->>'variant_id'))::uuid,
        (v_order_item->>'sale_price')::numeric,
        coalesce((v_order_item->>'discount')::numeric, 0),
        (v_order_item->>'final_price')::numeric,
        (v_order_item->>'wac_at_sale')::numeric,
        (v_order_item->>'profit')::numeric
      );
    end loop;
  end loop;

  for v_item in select * from jsonb_array_elements(p_backup->'deliveries')
  loop
    insert into public.deliveries(order_id, tracking, pickup_datetime, status)
    values (
      (v_order_map->>(v_item->>'order_id'))::uuid,
      coalesce(v_item->>'tracking', ''),
      coalesce(v_item->>'pickup_datetime', ''),
      v_item->>'status'
    );
  end loop;

  update public.variants v
  set qty_in_stock = (
    select count(*)::integer
    from public.stock_items s
    where s.variant_id = v.id
      and s.status = 'in_stock'
  );
end;
$$;

grant execute on function public.add_purchase_batch(date, numeric, numeric, jsonb, text) to authenticated;
grant execute on function public.create_order(jsonb) to authenticated;
grant execute on function public.update_order_status(uuid, text) to authenticated;
grant execute on function public.update_delivery(uuid, jsonb) to authenticated;
grant execute on function public.delete_order(uuid) to authenticated;
grant execute on function public.clear_store_data() to authenticated;
grant execute on function public.restore_backup(jsonb) to authenticated;

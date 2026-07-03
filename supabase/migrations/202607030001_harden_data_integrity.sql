create extension if not exists pgcrypto;

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

alter table public.order_items
  add column if not exists brand_name_snapshot text not null default '',
  add column if not exists model_name_snapshot text not null default '',
  add column if not exists variant_color_snapshot text not null default '';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'customer_id'
      and data_type <> 'uuid'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'legacy_customer_id'
  ) then
    alter table public.orders rename column customer_id to legacy_customer_id;
  end if;
end $$;

alter table public.orders
  add column if not exists customer_id uuid,
  add column if not exists legacy_customer_id text,
  add column if not exists customer_name_snapshot text not null default 'ลูกค้าทั่วไป';

update public.orders o
set customer_id = c.id,
    customer_name_snapshot = c.name
from public.customers c
where o.customer_id is null
  and o.legacy_customer_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and c.id = o.legacy_customer_id::uuid;

update public.orders
set customer_name_snapshot = coalesce(nullif(customer_name_snapshot, ''), nullif(legacy_customer_id, ''), 'ลูกค้าทั่วไป');

alter table public.orders
  drop constraint if exists orders_customer_id_fkey;

alter table public.orders
  add constraint orders_customer_id_fkey
  foreign key (customer_id) references public.customers(id) on delete set null;

update public.order_items oi
set brand_name_snapshot = coalesce(nullif(oi.brand_name_snapshot, ''), b.name, ''),
    model_name_snapshot = coalesce(nullif(oi.model_name_snapshot, ''), m.name, ''),
    variant_color_snapshot = coalesce(nullif(oi.variant_color_snapshot, ''), v.color, '')
from public.variants v
left join public.models m on m.id = v.model_id
left join public.brands b on b.id = m.brand_id
where oi.variant_id = v.id
  and (
    oi.brand_name_snapshot = ''
    or oi.model_name_snapshot = ''
    or oi.variant_color_snapshot = ''
  );

alter table public.order_items
  drop constraint if exists order_items_final_price_nonnegative,
  drop constraint if exists order_items_discount_lte_sale_price;

alter table public.order_items
  add constraint order_items_final_price_nonnegative check (final_price >= 0) not valid,
  add constraint order_items_discount_lte_sale_price check (discount <= sale_price) not valid;

alter table public.models drop constraint if exists models_brand_id_fkey;
alter table public.models
  add constraint models_brand_id_fkey
  foreign key (brand_id) references public.brands(id) on delete restrict;

alter table public.variants drop constraint if exists variants_model_id_fkey;
alter table public.variants
  add constraint variants_model_id_fkey
  foreign key (model_id) references public.models(id) on delete restrict;

alter table public.purchase_batch_items drop constraint if exists purchase_batch_items_variant_id_fkey;
alter table public.purchase_batch_items
  add constraint purchase_batch_items_variant_id_fkey
  foreign key (variant_id) references public.variants(id) on delete restrict;

alter table public.stock_items drop constraint if exists stock_items_variant_id_fkey;
alter table public.stock_items
  add constraint stock_items_variant_id_fkey
  foreign key (variant_id) references public.variants(id) on delete restrict;

alter table public.stock_items drop constraint if exists stock_items_batch_id_fkey;
alter table public.stock_items
  add constraint stock_items_batch_id_fkey
  foreign key (batch_id) references public.purchase_batches(id) on delete restrict;

alter table public.order_items drop constraint if exists order_items_stock_item_id_fkey;
alter table public.order_items
  add constraint order_items_stock_item_id_fkey
  foreign key (stock_item_id) references public.stock_items(id) on delete restrict;

alter table public.order_items drop constraint if exists order_items_variant_id_fkey;
alter table public.order_items
  add constraint order_items_variant_id_fkey
  foreign key (variant_id) references public.variants(id) on delete restrict;

create table if not exists public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'operator',
  created_at timestamptz not null default now(),
  constraint app_users_role_check check (role in ('owner', 'operator'))
);

alter table public.app_users enable row level security;

create or replace function public.is_store_user()
returns boolean
language sql
security definer
set search_path = public
as $$
  select auth.role() = 'authenticated'
    and (
      not exists (select 1 from public.app_users)
      or exists (
        select 1
        from public.app_users u
        where u.user_id = auth.uid()
      )
    );
$$;

grant execute on function public.is_store_user() to authenticated;

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
    execute format('drop policy if exists "%1$s store user access" on public.%1$I', table_name);
    execute format(
      'create policy "%1$s store user access" on public.%1$I for all to authenticated using (public.is_store_user()) with check (public.is_store_user())',
      table_name
    );
  end loop;
end $$;

drop policy if exists "app users store user access" on public.app_users;
create policy "app users store user access"
  on public.app_users
  for all
  to authenticated
  using (public.is_store_user())
  with check (public.is_store_user());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  drop policy if exists "product images read" on storage.objects;
  drop policy if exists "product images write" on storage.objects;

  create policy "product images read"
    on storage.objects
    for select
    to authenticated
    using (bucket_id = 'product-images' and public.is_store_user());

  create policy "product images write"
    on storage.objects
    for all
    to authenticated
    using (bucket_id = 'product-images' and public.is_store_user())
    with check (bucket_id = 'product-images' and public.is_store_user());
end $$;

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

    select count(*)::integer
    into v_available_count
    from public.stock_items
    where variant_id = v_variant_id
      and status = 'in_stock';

    if v_available_count < v_qty then
      raise exception 'สินค้าในสต็อกไม่เพียงพอสำหรับรายการนี้';
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
        profit,
        brand_name_snapshot,
        model_name_snapshot,
        variant_color_snapshot
      )
      values (
        v_order_id,
        v_stock.id,
        v_variant_id,
        v_sale_price,
        v_discount,
        v_final_price,
        v_stock.wac_cost,
        v_profit,
        v_brand_name,
        v_model_name,
        v_variant_color
      );

      v_order_subtotal := v_order_subtotal + v_final_price;
      v_taken_count := v_taken_count + 1;
    end loop;

    if v_taken_count < v_qty then
      raise exception 'สินค้าในสต็อกไม่เพียงพอสำหรับรายการนี้';
    end if;

    perform public.sync_variant_stock(v_variant_id);
  end loop;

  if (v_order_subtotal + v_shipping_fee - v_order_discount) < 0 then
    raise exception 'Order total cannot be negative';
  end if;

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
  if not public.is_store_user() then
    raise exception 'Authentication required';
  end if;

  if p_status not in ('pending', 'confirmed', 'shipped', 'delivered') then
    raise exception 'Invalid order status';
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
  if not public.is_store_user() then
    raise exception 'Authentication required';
  end if;

  if p_updates ? 'status'
    and p_updates->>'status' not in ('pending', 'dispatched', 'delivered') then
    raise exception 'Invalid delivery status';
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
  if not public.is_store_user() then
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
  if not public.is_store_user() then
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
  v_customer_id uuid;
  v_variant_id uuid;
  v_brand_map jsonb := '{}'::jsonb;
  v_model_map jsonb := '{}'::jsonb;
  v_variant_map jsonb := '{}'::jsonb;
  v_batch_map jsonb := '{}'::jsonb;
  v_stock_map jsonb := '{}'::jsonb;
  v_customer_map jsonb := '{}'::jsonb;
  v_order_map jsonb := '{}'::jsonb;
begin
  if not public.is_store_user() then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(p_backup->'brands') <> 'array'
    or jsonb_typeof(p_backup->'models') <> 'array'
    or jsonb_typeof(p_backup->'variants') <> 'array'
    or jsonb_typeof(p_backup->'purchaseBatches') <> 'array'
    or jsonb_typeof(p_backup->'stockItems') <> 'array'
    or jsonb_typeof(p_backup->'customers') <> 'array'
    or jsonb_typeof(p_backup->'orders') <> 'array'
    or jsonb_typeof(p_backup->'deliveries') <> 'array' then
    raise exception 'Invalid backup shape';
  end if;

  perform public.clear_store_data();

  for v_item in select * from jsonb_array_elements(p_backup->'brands')
  loop
    insert into public.brands(name, is_active, archived_at)
    values (
      v_item->>'name',
      coalesce((v_item->>'is_active')::boolean, true),
      nullif(v_item->>'archived_at', '')::timestamptz
    )
    returning id into v_new_id;
    v_brand_map := v_brand_map || jsonb_build_object(v_item->>'id', v_new_id::text);
  end loop;

  for v_item in select * from jsonb_array_elements(p_backup->'models')
  loop
    insert into public.models(brand_id, name, image, is_active, archived_at)
    values (
      (v_brand_map->>(v_item->>'brand_id'))::uuid,
      v_item->>'name',
      nullif(v_item->>'image', ''),
      coalesce((v_item->>'is_active')::boolean, true),
      nullif(v_item->>'archived_at', '')::timestamptz
    )
    returning id into v_new_id;
    v_model_map := v_model_map || jsonb_build_object(v_item->>'id', v_new_id::text);
  end loop;

  for v_item in select * from jsonb_array_elements(p_backup->'variants')
  loop
    insert into public.variants(model_id, color, qty_in_stock, current_wac, standard_sale_price, is_active, archived_at)
    values (
      (v_model_map->>(v_item->>'model_id'))::uuid,
      v_item->>'color',
      coalesce((v_item->>'qty_in_stock')::integer, 0),
      coalesce((v_item->>'current_wac')::numeric, 0),
      coalesce((v_item->>'standard_sale_price')::numeric, 0),
      coalesce((v_item->>'is_active')::boolean, true),
      nullif(v_item->>'archived_at', '')::timestamptz
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
    )
    returning id into v_new_id;
    v_customer_map := v_customer_map || jsonb_build_object(v_item->>'id', v_new_id::text);
  end loop;

  for v_item in select * from jsonb_array_elements(p_backup->'orders')
  loop
    v_old_id := v_item->>'id';
    v_customer_id := null;
    if nullif(v_item->>'customer_id', '') is not null
      and v_item->>'customer_id' <> 'general'
      and (v_customer_map ? (v_item->>'customer_id')) then
      v_customer_id := (v_customer_map->>(v_item->>'customer_id'))::uuid;
    end if;

    insert into public.orders(customer_id, customer_name_snapshot, date, channel, status, delivery_type, discount, shipping_fee, shipping_cost)
    values (
      v_customer_id,
      coalesce(nullif(v_item->>'customer_name_snapshot', ''), 'ลูกค้าทั่วไป'),
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
      v_variant_id := (v_variant_map->>(v_order_item->>'variant_id'))::uuid;

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
        (v_order_map->>(v_order_doc->>'id'))::uuid,
        (v_stock_map->>(v_order_item->>'stock_item_id'))::uuid,
        v_variant_id,
        (v_order_item->>'sale_price')::numeric,
        coalesce((v_order_item->>'discount')::numeric, 0),
        (v_order_item->>'final_price')::numeric,
        (v_order_item->>'wac_at_sale')::numeric,
        (v_order_item->>'profit')::numeric,
        coalesce(nullif(v_order_item->>'brand_name_snapshot', ''), b.name, ''),
        coalesce(nullif(v_order_item->>'model_name_snapshot', ''), m.name, ''),
        coalesce(nullif(v_order_item->>'variant_color_snapshot', ''), v.color, '')
      from public.variants v
      left join public.models m on m.id = v.model_id
      left join public.brands b on b.id = m.brand_id
      where v.id = v_variant_id;
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

grant execute on function public.archive_brand(uuid) to authenticated;
grant execute on function public.archive_model(uuid) to authenticated;
grant execute on function public.archive_variant(uuid) to authenticated;
grant execute on function public.add_purchase_batch(date, numeric, numeric, jsonb, text) to authenticated;
grant execute on function public.create_order(jsonb) to authenticated;
grant execute on function public.update_order_status(uuid, text) to authenticated;
grant execute on function public.update_delivery(uuid, jsonb) to authenticated;
grant execute on function public.delete_order(uuid) to authenticated;
grant execute on function public.clear_store_data() to authenticated;
grant execute on function public.restore_backup(jsonb) to authenticated;

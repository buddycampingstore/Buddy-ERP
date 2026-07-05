create extension if not exists pg_trgm;

do $$
begin
  if to_regprocedure('public.is_store_user()') is null then
    execute $function$
      create function public.is_store_user()
      returns boolean
      language sql
      security definer
      set search_path = public
      as $body$
        select auth.role() = 'authenticated';
      $body$
    $function$;
  end if;
end $$;

grant execute on function public.is_store_user() to authenticated;

alter table public.brands
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz;

alter table public.models
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz;

alter table public.variants
  add column if not exists image text,
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz;

update public.variants v
set image = m.image
from public.models m
where v.model_id = m.id
  and nullif(v.image, '') is null
  and nullif(m.image, '') is not null;

alter table public.orders
  add column if not exists customer_name_snapshot text not null default 'ลูกค้าทั่วไป';

update public.orders o
set customer_name_snapshot = coalesce(nullif(o.customer_name_snapshot, ''), c.name, 'ลูกค้าทั่วไป')
from public.customers c
where c.id::text = o.customer_id::text
  and nullif(o.customer_name_snapshot, '') is null;

update public.orders
set customer_name_snapshot = coalesce(nullif(customer_name_snapshot, ''), 'ลูกค้าทั่วไป');

alter table public.order_items
  add column if not exists brand_name_snapshot text not null default '',
  add column if not exists model_name_snapshot text not null default '',
  add column if not exists variant_color_snapshot text not null default '';

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

create index if not exists orders_status_date_id_idx
  on public.orders(status, date desc, id desc);

create index if not exists stock_items_in_stock_summary_idx
  on public.stock_items(variant_id)
  include (wac_cost)
  where status = 'in_stock';

create index if not exists orders_customer_name_snapshot_trgm_idx
  on public.orders
  using gin (lower(coalesce(customer_name_snapshot, '')) gin_trgm_ops);

create index if not exists customers_contact_trgm_idx
  on public.customers
  using gin (lower(coalesce(name, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(facebook, '')) gin_trgm_ops);

create index if not exists order_items_snapshot_trgm_idx
  on public.order_items
  using gin (lower(coalesce(brand_name_snapshot, '') || ' ' || coalesce(model_name_snapshot, '') || ' ' || coalesce(variant_color_snapshot, '')) gin_trgm_ops);

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
    ), '[]'::jsonb),
    'stock_summary', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'variant_id', v.id,
          'in_stock_qty', coalesce(v.qty_in_stock, 0),
          'in_stock_value', coalesce(v.qty_in_stock, 0) * coalesce(v.current_wac, 0)
        )
        order by v.color
      )
      from public.variants v
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.get_orders_page(
  p_limit integer default 50,
  p_offset integer default 0,
  p_status text default null,
  p_search text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_status text := nullif(coalesce(p_status, 'all'), 'all');
  v_search text := lower(nullif(trim(coalesce(p_search, '')), ''));
  v_result jsonb;
begin
  if not public.is_store_user() then
    raise exception 'Authentication required';
  end if;

  if v_status is not null and v_status not in ('pending', 'confirmed', 'shipped', 'delivered') then
    raise exception 'Invalid order status filter: %', v_status;
  end if;

  with filtered_orders as (
    select
      o.*,
      count(*) over() as total_count
    from public.orders o
    left join public.customers c on c.id::text = o.customer_id::text
    where (v_status is null or o.status = v_status)
      and (
        v_search is null
        or o.id::text ilike ('%' || v_search || '%')
        or lower(coalesce(o.customer_name_snapshot, '')) like ('%' || v_search || '%')
        or lower(coalesce(c.name, '') || ' ' || coalesce(c.phone, '') || ' ' || coalesce(c.facebook, '')) like ('%' || v_search || '%')
        or exists (
          select 1
          from public.order_items oi
          where oi.order_id = o.id
            and lower(coalesce(oi.brand_name_snapshot, '') || ' ' || coalesce(oi.model_name_snapshot, '') || ' ' || coalesce(oi.variant_color_snapshot, '')) like ('%' || v_search || '%')
        )
      )
    order by o.date desc, o.id desc
    limit v_limit
    offset v_offset
  ),
  order_items_by_order as (
    select
      oi.order_id,
      jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'stock_item_id', oi.stock_item_id,
          'variant_id', oi.variant_id,
          'sale_price', oi.sale_price,
          'discount', oi.discount,
          'final_price', oi.final_price,
          'wac_at_sale', oi.wac_at_sale,
          'profit', oi.profit,
          'brand_name_snapshot', oi.brand_name_snapshot,
          'model_name_snapshot', oi.model_name_snapshot,
          'variant_color_snapshot', oi.variant_color_snapshot
        )
        order by oi.created_at, oi.id
      ) as items
    from public.order_items oi
    where oi.order_id in (select id from filtered_orders)
    group by oi.order_id
  )
  select jsonb_build_object(
    'orders', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'customer_id', o.customer_id,
          'customer_name_snapshot', coalesce(nullif(o.customer_name_snapshot, ''), c.name, 'ลูกค้าทั่วไป'),
          'date', o.date,
          'channel', o.channel,
          'status', o.status,
          'delivery_type', o.delivery_type,
          'discount', o.discount,
          'shipping_fee', o.shipping_fee,
          'shipping_cost', o.shipping_cost,
          'items', coalesce(items.items, '[]'::jsonb)
        )
        order by o.date desc, o.id desc
      )
      from filtered_orders o
      left join public.customers c on c.id::text = o.customer_id::text
      left join order_items_by_order items on items.order_id = o.id
    ), '[]'::jsonb),
    'deliveries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'order_id', d.order_id,
          'tracking', d.tracking,
          'pickup_datetime', d.pickup_datetime,
          'status', d.status
        )
        order by d.created_at, d.id
      )
      from public.deliveries d
      where d.order_id in (select id from filtered_orders)
    ), '[]'::jsonb),
    'total_count', coalesce((select max(total_count) from filtered_orders), 0)
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
          'unit_price', pbi.unit_price
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

create or replace function public.get_dashboard_summary(p_month text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start date;
  v_month_end date;
  v_result jsonb;
begin
  if not public.is_store_user() then
    raise exception 'Authentication required';
  end if;

  if p_month is null or p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Invalid month. Expected YYYY-MM';
  end if;

  v_month_start := (p_month || '-01')::date;
  v_month_end := (v_month_start + interval '1 month')::date;

  with month_orders as (
    select *
    from public.orders
    where date >= v_month_start
      and date < v_month_end
  ),
  month_order_totals as (
    select
      o.id,
      o.date,
      o.channel,
      o.status,
      coalesce(sum(oi.final_price), 0)
        + coalesce(o.shipping_fee, 0)
        - coalesce(o.discount, 0) as revenue,
      coalesce(sum(oi.profit), 0)
        + coalesce(o.shipping_fee, 0)
        - coalesce(o.shipping_cost, 0)
        - coalesce(o.discount, 0) as profit
    from month_orders o
    left join public.order_items oi on oi.order_id = o.id
    group by o.id, o.date, o.channel, o.status, o.shipping_fee, o.shipping_cost, o.discount
  ),
  purchase_totals as (
    select
      pb.id,
      coalesce(sum(pbi.qty * pbi.unit_price), 0)
        + coalesce(pb.shipping_cost, 0)
        + coalesce(pb.other_cost, 0) as total_cost
    from public.purchase_batches pb
    left join public.purchase_batch_items pbi on pbi.batch_id = pb.id
    where pb.date >= v_month_start
      and pb.date < v_month_end
    group by pb.id, pb.shipping_cost, pb.other_cost
  ),
  recent_orders as (
    select
      o.id,
      o.date,
      o.channel,
      o.status,
      coalesce(sum(oi.final_price), 0)
        + coalesce(o.shipping_fee, 0)
        - coalesce(o.discount, 0) as revenue
    from (
      select *
      from public.orders
      order by date desc, id desc
      limit 5
    ) o
    left join public.order_items oi on oi.order_id = o.id
    group by o.id, o.date, o.channel, o.status, o.shipping_fee, o.discount
  )
  select jsonb_build_object(
    'month', p_month,
    'stock_qty', (
      select coalesce(sum(qty_in_stock), 0)::integer
      from public.variants
    ),
    'stock_value', (
      select coalesce(sum(qty_in_stock * current_wac), 0)::numeric
      from public.variants
    ),
    'month_sales', (
      select coalesce(sum(revenue), 0)::numeric
      from month_order_totals
    ),
    'month_profit', (
      select coalesce(sum(profit), 0)::numeric
      from month_order_totals
    ),
    'month_purchase_cost', (
      select coalesce(sum(total_cost), 0)::numeric
      from purchase_totals
    ),
    'pending_orders_count', (
      select count(*)::integer
      from public.orders
      where status <> 'delivered'
    ),
    'recent_orders', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', recent.id,
          'date', recent.date,
          'channel', recent.channel,
          'status', recent.status,
          'total', recent.revenue
        )
        order by recent.date desc, recent.id desc
      )
      from recent_orders recent
    ), '[]'::jsonb),
    'low_stock_variants', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', low_stock.id,
          'name', low_stock.name,
          'qty_in_stock', low_stock.qty_in_stock
        )
        order by low_stock.qty_in_stock asc, low_stock.name asc
      )
      from (
        select
          v.id,
          concat_ws(' ', b.name, m.name) || ' (' || v.color || ')' as name,
          v.qty_in_stock
        from public.variants v
        join public.models m on m.id = v.model_id
        join public.brands b on b.id = m.brand_id
        where coalesce(v.is_active, true) = true
          and coalesce(m.is_active, true) = true
          and coalesce(b.is_active, true) = true
          and v.qty_in_stock <= 3
        order by v.qty_in_stock asc, b.name asc, m.name asc, v.color asc
        limit 10
      ) low_stock
    ), '[]'::jsonb),
    'channel_chart', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', channel_totals.name,
          'value', round(channel_totals.value)
        )
        order by channel_totals.name
      )
      from (
        select
          case channel
            when 'fb' then 'Facebook'
            when 'ig' then 'Instagram'
            else 'อื่นๆ'
          end as name,
          sum(revenue) as value
        from month_order_totals
        group by channel
      ) channel_totals
    ), '[]'::jsonb),
    'daily_sales', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', daily.date_label,
          'ยอดขาย (บาท)', round(daily.value)
        )
        order by daily.date_value
      )
      from (
        select
          date as date_value,
          to_char(date, 'MM-DD') as date_label,
          sum(revenue) as value
        from month_order_totals
        group by date
      ) daily
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_products_payload() to authenticated;
grant execute on function public.get_orders_page(integer, integer, text, text) to authenticated;
grant execute on function public.get_purchase_page(integer, integer) to authenticated;
grant execute on function public.get_dashboard_summary(text) to authenticated;

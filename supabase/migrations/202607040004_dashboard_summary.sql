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

  with order_totals as (
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
    from public.orders o
    left join public.order_items oi on oi.order_id = o.id
    group by o.id
  ),
  month_order_totals as (
    select *
    from order_totals
    where date >= v_month_start
      and date < v_month_end
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
    group by pb.id
  )
  select jsonb_build_object(
    'month', p_month,
    'stock_qty', (
      select count(*)::integer
      from public.stock_items
      where status = 'in_stock'
    ),
    'stock_value', (
      select coalesce(sum(wac_cost), 0)::numeric
      from public.stock_items
      where status = 'in_stock'
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
      from (
        select *
        from order_totals
        order by date desc, id desc
        limit 5
      ) recent
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
        order by daily.date_label
      )
      from (
        select
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

grant execute on function public.get_dashboard_summary(text) to authenticated;

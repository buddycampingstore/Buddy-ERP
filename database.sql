-- Buddy ERP database schema
-- Current app-compatible Supabase schema.
-- The React app reads and writes exactly this table via src/hooks/useSupabase.ts.

create table if not exists public.buddy_erp_backoffice (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists buddy_erp_backoffice_updated_at_idx
  on public.buddy_erp_backoffice (updated_at desc);

create index if not exists buddy_erp_backoffice_data_gin_idx
  on public.buddy_erp_backoffice using gin (data);

alter table public.buddy_erp_backoffice enable row level security;

drop policy if exists "buddy_erp_backoffice_authenticated_read" on public.buddy_erp_backoffice;
create policy "buddy_erp_backoffice_authenticated_read"
  on public.buddy_erp_backoffice
  for select
  to authenticated
  using (true);

drop policy if exists "buddy_erp_backoffice_authenticated_write" on public.buddy_erp_backoffice;
create policy "buddy_erp_backoffice_authenticated_write"
  on public.buddy_erp_backoffice
  for all
  to authenticated
  using (true)
  with check (true);

comment on table public.buddy_erp_backoffice is
  'Single-row JSON backup/sync table used by the current Buddy ERP frontend.';

comment on column public.buddy_erp_backoffice.id is
  'Sync key selected in the app. Default value used by the UI is "default".';

comment on column public.buddy_erp_backoffice.data is
  'Full AppDatabase JSON: brands, models, variants, purchaseBatches, stockItems, customers, orders, deliveries.';


-- Optional relational schema for a future normalized database version.
-- The current frontend does not use these tables unless the app code is updated.

create table if not exists public.brands (
  id text primary key,
  name text not null
);

create table if not exists public.models (
  id text primary key,
  brand_id text not null references public.brands (id) on delete cascade,
  name text not null,
  image text
);

create table if not exists public.variants (
  id text primary key,
  model_id text not null references public.models (id) on delete cascade,
  color text not null,
  qty_in_stock integer not null default 0 check (qty_in_stock >= 0),
  current_wac numeric(12, 2) not null default 0 check (current_wac >= 0),
  standard_sale_price numeric(12, 2) not null default 0 check (standard_sale_price >= 0)
);

create table if not exists public.purchase_batches (
  id text primary key,
  date date not null,
  shipping_cost numeric(12, 2) not null default 0 check (shipping_cost >= 0),
  other_cost numeric(12, 2) not null default 0 check (other_cost >= 0),
  note text
);

create table if not exists public.purchase_batch_items (
  id bigserial primary key,
  purchase_batch_id text not null references public.purchase_batches (id) on delete cascade,
  variant_id text not null references public.variants (id) on delete restrict,
  qty integer not null check (qty > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0)
);

do $$
begin
  create type public.stock_item_status as enum ('in_stock', 'sold');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.stock_items (
  id text primary key,
  variant_id text not null references public.variants (id) on delete cascade,
  wac_cost numeric(12, 2) not null default 0 check (wac_cost >= 0),
  status public.stock_item_status not null default 'in_stock',
  order_id text,
  batch_id text not null references public.purchase_batches (id) on delete restrict
);

create table if not exists public.customers (
  id text primary key,
  name text not null,
  phone text not null default '',
  facebook text not null default '',
  note text not null default ''
);

do $$
begin
  create type public.order_status as enum ('pending', 'confirmed', 'shipped', 'delivered');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.order_channel as enum ('fb', 'ig', 'other');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.delivery_type as enum ('shipping', 'pickup');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.orders (
  id text primary key,
  customer_id text not null references public.customers (id) on delete restrict,
  date date not null,
  channel public.order_channel not null,
  status public.order_status not null default 'pending',
  delivery_type public.delivery_type not null,
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  shipping_fee numeric(12, 2) not null default 0 check (shipping_fee >= 0),
  shipping_cost numeric(12, 2) not null default 0 check (shipping_cost >= 0)
);

alter table public.stock_items
  drop constraint if exists stock_items_order_id_fkey;

alter table public.stock_items
  add constraint stock_items_order_id_fkey
  foreign key (order_id) references public.orders (id) on delete set null;

create table if not exists public.order_items (
  id text primary key,
  order_id text not null references public.orders (id) on delete cascade,
  stock_item_id text not null references public.stock_items (id) on delete restrict,
  variant_id text not null references public.variants (id) on delete restrict,
  sale_price numeric(12, 2) not null check (sale_price >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  final_price numeric(12, 2) not null check (final_price >= 0),
  wac_at_sale numeric(12, 2) not null check (wac_at_sale >= 0),
  profit numeric(12, 2) not null
);

do $$
begin
  create type public.delivery_status as enum ('pending', 'dispatched', 'delivered');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.deliveries (
  id text primary key,
  order_id text not null references public.orders (id) on delete cascade,
  tracking text not null default '',
  pickup_datetime timestamp,
  status public.delivery_status not null default 'pending'
);

create index if not exists models_brand_id_idx on public.models (brand_id);
create index if not exists variants_model_id_idx on public.variants (model_id);
create index if not exists purchase_batch_items_batch_id_idx on public.purchase_batch_items (purchase_batch_id);
create index if not exists purchase_batch_items_variant_id_idx on public.purchase_batch_items (variant_id);
create index if not exists stock_items_variant_status_idx on public.stock_items (variant_id, status);
create index if not exists stock_items_order_id_idx on public.stock_items (order_id);
create index if not exists orders_customer_id_idx on public.orders (customer_id);
create index if not exists orders_date_idx on public.orders (date desc);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_variant_id_idx on public.order_items (variant_id);
create index if not exists deliveries_order_id_idx on public.deliveries (order_id);
create index if not exists deliveries_status_idx on public.deliveries (status);

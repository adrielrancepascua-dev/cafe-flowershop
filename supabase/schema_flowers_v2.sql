-- Papers & Petals — Flowers v2 schema (Supabase)
-- Run in Supabase SQL editor when connecting production auth/storage.

create table if not exists public.flower_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  role text not null check (role in ('staff', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.flower_branches (
  id text primary key,
  name text not null,
  is_active boolean not null default true
);

insert into public.flower_branches (id, name, is_active) values
  ('branch-dagupan', 'Dagupan', true),
  ('branch-san-carlos', 'San Carlos', true),
  ('branch-urdaneta', 'Urdaneta', true)
on conflict (id) do update set name = excluded.name;

create table if not exists public.flower_products (
  id text primary key,
  name text not null,
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.flower_orders (
  id text primary key,
  branch_id text not null references public.flower_branches(id),
  receiver text not null,
  customer_social text not null,
  scheduled_for timestamptz not null,
  status text not null,
  claim_mode text not null check (claim_mode in ('pickup', 'delivery')),
  wrapper_color text not null default '',
  greeting_card text not null default '',
  special_instructions text not null default '',
  downpayment numeric(12,2) not null default 0,
  payment_reference text not null default '',
  total_amount numeric(12,2) not null check (total_amount >= 0),
  balance numeric(12,2) not null default 0,
  notes text not null default '',
  photo_inspo_data_url text not null default '',
  proof_dp_data_url text not null default '',
  order_form_ss_data_url text not null default '',
  created_by_id text not null,
  created_by_name text not null,
  inventory_deducted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.flower_order_items (
  id bigint generated always as identity primary key,
  order_id text not null references public.flower_orders(id) on delete cascade,
  product_id text not null references public.flower_products(id),
  item_name text not null,
  quantity integer not null check (quantity > 0)
);

create table if not exists public.flower_inventory_stock (
  branch_id text not null references public.flower_branches(id),
  product_id text not null references public.flower_products(id),
  on_hand integer not null default 0,
  updated_at timestamptz,
  primary key (branch_id, product_id)
);

create table if not exists public.flower_inventory_movements (
  id bigint generated always as identity primary key,
  branch_id text not null references public.flower_branches(id),
  product_id text not null references public.flower_products(id),
  movement_type text not null,
  quantity integer not null check (quantity > 0),
  previous_on_hand integer not null,
  new_on_hand integer not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.flower_staff_expenses (
  id text primary key,
  staff_id text not null,
  staff_name text not null,
  branch_id text not null references public.flower_branches(id),
  amount numeric(12,2) not null check (amount >= 0),
  description text not null,
  expense_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.flower_supplier_costs (
  id text primary key,
  branch_id text not null references public.flower_branches(id),
  product_id text references public.flower_products(id),
  amount numeric(12,2) not null check (amount >= 0),
  description text not null,
  cost_date date not null,
  created_by_id text not null,
  created_by_name text not null,
  created_at timestamptz not null default now()
);

alter table public.flower_profiles enable row level security;
alter table public.flower_orders enable row level security;
alter table public.flower_order_items enable row level security;
alter table public.flower_products enable row level security;
alter table public.flower_inventory_stock enable row level security;
alter table public.flower_inventory_movements enable row level security;
alter table public.flower_staff_expenses enable row level security;
alter table public.flower_supplier_costs enable row level security;

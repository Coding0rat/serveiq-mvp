-- ServeIQ schema, seed data, and RLS policies
-- Run this in Supabase SQL Editor after creating a new project.
-- The local browser demo does not require this file. See README.md for Supabase setup notes.

create extension if not exists pgcrypto;

create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique check (number > 0),
  qr_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 80),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '' check (length(description) <= 400),
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  is_veg boolean not null default true,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.item_pairings (
  item_id uuid not null references public.menu_items(id) on delete cascade,
  paired_item_id uuid not null references public.menu_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, paired_item_id),
  constraint no_self_pairing check (item_id <> paired_item_id)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('kitchen','admin')),
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables(id) on delete restrict,
  status text not null default 'placed' check (status in ('placed','accepted','preparing','ready','served')),
  -- `total` stores the grand total including the 5% GST.
  total numeric(10,2) not null default 0 check (total >= 0),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed')),
  payment_method text not null default 'pay_at_reception' check (payment_method in ('pay_at_reception','pay_online')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 20),
  notes text not null default '' check (length(notes) <= 240),
  price numeric(10,2) not null check (price >= 0)
);

-- Gateway records are private server-side audit data. The browser cannot read
-- or write them; Razorpay is verified by Edge Functions before an order is paid.
create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  provider text not null default 'razorpay' check (provider = 'razorpay'),
  gateway_order_id text not null unique,
  gateway_payment_id text unique,
  amount_paise integer not null check (amount_paise >= 100),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'created' check (status in ('created','failed','captured')),
  failure_reason text,
  signature_verified_at timestamptz,
  captured_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_menu_items_category on public.menu_items(category_id);
create index if not exists idx_menu_items_availability on public.menu_items(is_available);
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_order_items_menu_item on public.order_items(menu_item_id);
create index if not exists idx_payment_attempts_order on public.payment_attempts(order_id);

-- All authorization decisions are made from server-owned profile rows.
create or replace function public.current_user_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid() limit 1;
$$;
revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to anon, authenticated;

alter table public.tables enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.item_pairings enable row level security;
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_attempts enable row level security;

-- Public guest menu can show unavailable items in a disabled/grey state.
drop policy if exists "Anyone can read categories" on public.categories;
create policy "Anyone can read categories" on public.categories for select to anon, authenticated using (true);
drop policy if exists "Anyone can read menu" on public.menu_items;
create policy "Anyone can read menu" on public.menu_items for select to anon, authenticated using (true);
drop policy if exists "Anyone can read item pairings" on public.item_pairings;
create policy "Anyone can read item pairings" on public.item_pairings for select to anon, authenticated using (true);
drop policy if exists "Guests can read active tables" on public.tables;
create policy "Guests can read active tables" on public.tables for select to anon using (is_active = true);
drop policy if exists "Staff can read all tables" on public.tables;
create policy "Staff can read all tables" on public.tables for select to authenticated using (public.current_user_role() in ('admin','kitchen'));

-- Admin CRUD policies.
drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories" on public.categories for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists "Admins manage menu" on public.menu_items;
create policy "Admins manage menu" on public.menu_items for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists "Admins manage pairings" on public.item_pairings;
create policy "Admins manage pairings" on public.item_pairings for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists "Admins manage tables" on public.tables;
create policy "Admins manage tables" on public.tables for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists "Users can read own profile; admins can read all" on public.profiles;
create policy "Users can read own profile; admins can read all" on public.profiles for select to authenticated using (id = auth.uid() or public.current_user_role() = 'admin');
drop policy if exists "Admins manage profiles" on public.profiles;
create policy "Admins manage profiles" on public.profiles for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- Explicit grants complement RLS. Policies do not grant table privileges by themselves.
grant usage on schema public to anon, authenticated;
grant select on public.categories, public.menu_items, public.item_pairings, public.tables to anon, authenticated;
grant insert, update, delete on public.categories, public.menu_items, public.item_pairings, public.tables to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;

-- Private broadcast channel for staff ticket updates. Guest order channels are public but only broadcast status/payment metadata.
-- Supabase already enables RLS on its managed realtime.messages table. Do not
-- ALTER it here: project SQL roles do not own that internal table.
drop policy if exists "ServeIQ staff can read ticket board broadcasts" on realtime.messages;
create policy "ServeIQ staff can read ticket board broadcasts" on realtime.messages
  for select to authenticated
  using (extension = 'broadcast' and topic = 'orders:all' and public.current_user_role() in ('admin','kitchen'));

-- Only authenticated staff can directly read orders/order items.
-- Guests use get_public_order_snapshot(order_id) plus a status-only Realtime broadcast.
drop policy if exists "Staff read orders" on public.orders;
create policy "Staff read orders" on public.orders for select to authenticated using (public.current_user_role() in ('admin','kitchen'));
drop policy if exists "Staff read order items" on public.order_items;
create policy "Staff read order items" on public.order_items for select to authenticated using (public.current_user_role() in ('admin','kitchen'));
-- Staff cannot insert arbitrary client-priced orders or set arbitrary paid states.
-- Order creation, status changes and bill settlement use checked RPC functions below.
revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;
grant select on public.orders, public.order_items to authenticated;

-- No client permissions: payment attempts are used only by service-role Edge
-- Functions after the Razorpay signature or webhook has been verified.
revoke all on public.payment_attempts from anon, authenticated;

-- Atomic order creation: validates active table, item availability, quantities, and canonical prices on the database.
create or replace function public.place_order(
  p_table_id uuid,
  p_items jsonb,
  p_payment_method text default 'pay_at_reception'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_row jsonb;
  v_menu_id uuid;
  v_quantity integer;
  v_notes text;
  v_price numeric(10,2);
  v_available boolean;
  v_subtotal numeric(10,2) := 0;
  v_table_active boolean;
begin
  if p_payment_method not in ('pay_at_reception','pay_online') then
    raise exception 'Unsupported payment method';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Order must contain between 1 and 50 item rows';
  end if;
  select t.is_active into v_table_active from public.tables t where t.id = p_table_id;
  if coalesce(v_table_active,false) = false then raise exception 'Table is not active'; end if;

  -- First pass: validate every item before creating any rows.
  for v_row in select value from jsonb_array_elements(p_items) loop
    begin
      v_menu_id := (v_row->>'menu_item_id')::uuid;
      v_quantity := (v_row->>'quantity')::integer;
    exception when others then raise exception 'Invalid menu item id or quantity';
    end;
    if v_quantity < 1 or v_quantity > 20 then raise exception 'Quantity must be between 1 and 20'; end if;
    v_notes := left(coalesce(v_row->>'notes',''),240);
    select mi.price,mi.is_available into v_price,v_available from public.menu_items mi where mi.id=v_menu_id;
    if not found then raise exception 'Menu item not found'; end if;
    if not v_available then raise exception 'An item in this order is unavailable'; end if;
    v_subtotal := v_subtotal + v_price * v_quantity;
  end loop;

  insert into public.orders(id,table_id,status,total,payment_status,payment_method)
  values(v_order_id,p_table_id,'placed',round(v_subtotal * 1.05,2),'pending',p_payment_method);

  for v_row in select value from jsonb_array_elements(p_items) loop
    v_menu_id := (v_row->>'menu_item_id')::uuid;
    v_quantity := (v_row->>'quantity')::integer;
    v_notes := left(coalesce(v_row->>'notes',''),240);
    select mi.price into v_price from public.menu_items mi where mi.id=v_menu_id and mi.is_available=true;
    if not found then raise exception 'An item became unavailable; please try again'; end if;
    insert into public.order_items(order_id,menu_item_id,quantity,notes,price)
    values(v_order_id,v_menu_id,v_quantity,v_notes,v_price);
  end loop;
  return v_order_id;
end;
$$;
revoke all on function public.place_order(uuid,jsonb,text) from public;
grant execute on function public.place_order(uuid,jsonb,text) to anon, authenticated;

-- Limited guest snapshot; the random UUID acts as the unguessable guest order link.
create or replace function public.get_public_order_snapshot(p_order_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'id',o.id,'table_id',o.table_id,'status',o.status,'total',o.total,
    'payment_status',o.payment_status,'payment_method',o.payment_method,'created_at',o.created_at,
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',oi.id,'menu_item_id',oi.menu_item_id,'name',mi.name,'quantity',oi.quantity,'notes',oi.notes,'price',oi.price) order by oi.id)
                      from public.order_items oi join public.menu_items mi on mi.id=oi.menu_item_id where oi.order_id=o.id),'[]'::jsonb)
  ) into v_result from public.orders o where o.id=p_order_id;
  return v_result;
end;
$$;
revoke all on function public.get_public_order_snapshot(uuid) from public;
grant execute on function public.get_public_order_snapshot(uuid) to anon, authenticated;

-- Kitchen status updates are limited to valid next steps and staff roles.
create or replace function public.advance_order_status(p_order_id uuid, p_next_status text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_current text;
begin
  if public.current_user_role() not in ('kitchen','admin') then raise exception 'Staff access required'; end if;
  if p_next_status not in ('accepted','preparing','ready','served') then raise exception 'Invalid status'; end if;
  select status into v_current from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if not ((v_current='placed' and p_next_status='accepted') or (v_current='accepted' and p_next_status='preparing') or (v_current='preparing' and p_next_status='ready') or (v_current='ready' and p_next_status='served')) then
    raise exception 'Invalid order status transition';
  end if;
  update public.orders set status=p_next_status where id=p_order_id;
end;
$$;
revoke all on function public.advance_order_status(uuid,text) from public;
grant execute on function public.advance_order_status(uuid,text) to authenticated;

create or replace function public.admin_mark_bill_paid(p_order_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_payment_method text;
begin
  if public.current_user_role() <> 'admin' then raise exception 'Administrator access required'; end if;
  select payment_method into v_payment_method from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_payment_method <> 'pay_at_reception' then raise exception 'Online payments are confirmed only by the payment gateway'; end if;
  update public.orders set payment_status='paid',paid_at=now() where id=p_order_id;
end;
$$;
revoke all on function public.admin_mark_bill_paid(uuid) from public;
grant execute on function public.admin_mark_bill_paid(uuid) to authenticated;

-- The browser must never mark an online bill paid. Razorpay test/live payments
-- are confirmed only by the server-side Edge Functions and signed webhooks.
drop function if exists public.mock_online_payment(uuid,boolean);

-- Rule-based suggestions: explicit admin pairings rank first, then items co-ordered most often.
create or replace function public.get_item_recommendations(p_item_id uuid)
returns table(id uuid,name text,description text,price numeric,image_url text,is_veg boolean,is_available boolean)
language sql stable security definer
set search_path = public
as $$
  with explicit as (
    select ip.paired_item_id as item_id, 0 as priority, 0::bigint as co_count
    from public.item_pairings ip
    where ip.item_id=p_item_id
  ), co_ordered as (
    select oi2.menu_item_id as item_id, 1 as priority, count(distinct oi1.order_id)::bigint as co_count
    from public.order_items oi1
    join public.order_items oi2 on oi1.order_id=oi2.order_id and oi1.menu_item_id<>oi2.menu_item_id
    where oi1.menu_item_id=p_item_id
    group by oi2.menu_item_id
  ), candidates as (
    select * from explicit union all select * from co_ordered
  ), ranked as (
    select c.item_id,min(c.priority) as priority,max(c.co_count) as co_count
    from candidates c where c.item_id<>p_item_id group by c.item_id
  )
  select mi.id,mi.name,mi.description,mi.price,mi.image_url,mi.is_veg,mi.is_available
  from ranked r join public.menu_items mi on mi.id=r.item_id
  where mi.is_available=true
  order by r.priority asc,r.co_count desc,mi.name asc
  limit 3;
$$;
revoke all on function public.get_item_recommendations(uuid) from public;
grant execute on function public.get_item_recommendations(uuid) to anon, authenticated;

-- Status-only public Broadcast for a customer who has the unguessable order UUID.
-- Clients subscribe to the public channel topic: order:<UUID>. No customer table SELECT grant is needed.
create or replace function public.broadcast_order_status()
returns trigger
language plpgsql security definer
set search_path = public, realtime
as $$
begin
  if (TG_OP='INSERT') or (OLD.status is distinct from NEW.status) or (OLD.payment_status is distinct from NEW.payment_status) then
    perform realtime.send(
      jsonb_build_object('id',NEW.id,'status',NEW.status,'payment_status',NEW.payment_status,'payment_method',NEW.payment_method,'updated_at',now()),
      'order_update', 'order:' || NEW.id::text, false
    );
    perform realtime.send(
      jsonb_build_object('id',NEW.id,'status',NEW.status,'payment_status',NEW.payment_status,'payment_method',NEW.payment_method,'updated_at',now()),
      'order_update', 'orders:all', true
    );
  end if;
  return NEW;
end;
$$;
drop trigger if exists orders_broadcast_status on public.orders;
create trigger orders_broadcast_status after insert or update of status,payment_status on public.orders
for each row execute function public.broadcast_order_status();

-- Seed 4 categories, 20 menu items, 5 tables, explicit pairings and historical order items.
insert into public.categories(id,name,sort_order) values
('10000000-0000-4000-8000-000000000001','Small Plates',1),
('10000000-0000-4000-8000-000000000002','Mains',2),
('10000000-0000-4000-8000-000000000003','Drinks',3),
('10000000-0000-4000-8000-000000000004','Desserts',4)
on conflict (id) do nothing;

insert into public.tables(id,number,qr_url,is_active) values
('20000000-0000-4000-8000-000000000001',1,'/t/20000000-0000-4000-8000-000000000001',true),
('20000000-0000-4000-8000-000000000002',2,'/t/20000000-0000-4000-8000-000000000002',true),
('20000000-0000-4000-8000-000000000003',3,'/t/20000000-0000-4000-8000-000000000003',true),
('20000000-0000-4000-8000-000000000004',4,'/t/20000000-0000-4000-8000-000000000004',true),
('20000000-0000-4000-8000-000000000005',5,'/t/20000000-0000-4000-8000-000000000005',true)
on conflict (id) do nothing;

insert into public.menu_items(id,category_id,name,description,price,image_url,is_veg,is_available) values
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Truffle Parmesan Fries','Crispy fries, parmesan snow and a little truffle oil.',249,'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=82',true,true),
('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Crispy Lotus Stem','Honey chilli glaze, sesame and spring onion.',289,'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=82',true,true),
('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Paneer Tikka','Charred cottage cheese, mint chutney and lime.',329,'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=900&q=82',true,true),
('30000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Chilli Garlic Prawns','Wok-tossed prawns, garlic butter and herbs.',429,'https://images.unsplash.com/photo-1625944525533-473f1a3d54e7?auto=format&fit=crop&w=900&q=82',false,true),
('30000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','Cajun Chicken Bites','Crisp chicken, smoky cajun dust and house dip.',359,'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?auto=format&fit=crop&w=900&q=82',false,true),
('30000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','Avocado Toast','Sourdough, smashed avocado and chilli flakes.',319,'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=82',true,true),
('30000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000002','Wild Mushroom Risotto','Arborio rice, forest mushrooms and aged parmesan.',449,'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=900&q=82',true,true),
('30000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000002','Classic Margherita Pizza','San Marzano tomato, mozzarella and fresh basil.',399,'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=82',true,true),
('30000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000002','Smoky BBQ Chicken Pizza','BBQ chicken, red onion and smoked mozzarella.',489,'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?auto=format&fit=crop&w=900&q=82',false,true),
('30000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000002','Butter Paneer Bowl','Creamy tomato paneer with jeera rice.',379,'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=82',true,true),
('30000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000002','Herb Grilled Chicken','Chicken breast, seasonal vegetables and jus.',529,'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=900&q=82',false,true),
('30000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000002','Thai Green Curry','Coconut green curry, vegetables and steamed rice.',429,'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?auto=format&fit=crop&w=900&q=82',true,true),
('30000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000002','Classic Chicken Burger','Grilled chicken, lettuce, pickles and house sauce.',399,'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=82',false,true),
('30000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000003','Mango Mint Cooler','Fresh mango, mint, lime and sparkling water.',179,'https://images.unsplash.com/photo-1513558161293-cafb765edfd7?auto=format&fit=crop&w=900&q=82',true,true),
('30000000-0000-4000-8000-000000000015','10000000-0000-4000-8000-000000000003','Cold Brew Tonic','Slow-steeped coffee, tonic and orange peel.',199,'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=82',true,true),
('30000000-0000-4000-8000-000000000016','10000000-0000-4000-8000-000000000003','Watermelon Cooler','Fresh watermelon juice with a squeeze of lime.',159,'https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=900&q=82',true,true),
('30000000-0000-4000-8000-000000000017','10000000-0000-4000-8000-000000000003','Classic Masala Chai','Slow-simmered tea with ginger and warming spices.',99,'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=900&q=82',true,true),
('30000000-0000-4000-8000-000000000018','10000000-0000-4000-8000-000000000004','Warm Chocolate Brownie','Dark chocolate brownie and vanilla bean ice cream.',229,'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=82',true,true),
('30000000-0000-4000-8000-000000000019','10000000-0000-4000-8000-000000000004','Baked Cheesecake','Vanilla cheesecake, berry compote and crumb.',259,'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=900&q=82',true,true),
('30000000-0000-4000-8000-000000000020','10000000-0000-4000-8000-000000000004','Classic Tiramisu','Espresso-soaked sponge, mascarpone and cocoa.',269,'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=900&q=82',true,false)
on conflict (id) do nothing;

insert into public.item_pairings(item_id,paired_item_id) values
('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000015'),
('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000014'),
('30000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000014'),
('30000000-0000-4000-8000-000000000008','30000000-0000-4000-8000-000000000016'),
('30000000-0000-4000-8000-000000000010','30000000-0000-4000-8000-000000000017'),
('30000000-0000-4000-8000-000000000018','30000000-0000-4000-8000-000000000015'),
('30000000-0000-4000-8000-000000000011','30000000-0000-4000-8000-000000000012'),
('30000000-0000-4000-8000-000000000013','30000000-0000-4000-8000-000000000016')
on conflict do nothing;

-- Historical sample orders seed co-order data for recommendations. These are intentionally yesterday/2 days ago.
insert into public.orders(id,table_id,status,total,payment_status,payment_method,created_at,paid_at) values
('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','served',710.85,'paid','pay_at_reception',now()-interval '1 day',now()-interval '1 day'),
('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004','served',931.35,'paid','pay_online',now()-interval '2 days',now()-interval '2 days'),
('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','served',868.35,'paid','pay_at_reception',now()-interval '3 days',now()-interval '3 days')
on conflict (id) do nothing;

insert into public.order_items(id,order_id,menu_item_id,quantity,notes,price) values
('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',1,'',249),
('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000015',1,'',199),
('50000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000018',1,'',229),
('50000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000008',1,'',399),
('50000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000016',1,'',159),
('50000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003',1,'',329),
('50000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001',1,'',249),
('50000000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000015',1,'',199),
('50000000-0000-4000-8000-000000000009','40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000010',1,'',379)
on conflict (id) do nothing;

-- Profiles are tied to Supabase Auth UUIDs and therefore cannot be seeded with fake IDs.
-- Once an auth user exists, assign role with SQL, e.g.:
-- insert into public.profiles(id,role,display_name) values ('<AUTH_USER_UUID>','admin','Restaurant Admin');
-- insert into public.profiles(id,role,display_name) values ('<AUTH_USER_UUID>','kitchen','Kitchen Team');

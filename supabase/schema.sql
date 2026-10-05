-- Run once in the Supabase SQL Editor, then import catalog_items.csv in Table Editor.
create table if not exists public.catalog_admins (
  email text primary key
);
create table if not exists public.catalog_items (
  id text primary key,
  data jsonb not null,
  note text
);

alter table public.catalog_admins enable row level security;
alter table public.catalog_items enable row level security;

revoke all on public.catalog_admins from anon, authenticated;
grant select on public.catalog_admins to authenticated;
grant select on public.catalog_items to anon, authenticated;
grant insert, update, delete on public.catalog_items to authenticated;

create policy "Editors can see own membership" on public.catalog_admins
  for select to authenticated using (email = (auth.jwt() ->> 'email'));
create policy "Anyone can read catalog" on public.catalog_items
  for select to anon, authenticated using (true);
create policy "Editors can add catalog entries" on public.catalog_items
  for insert to authenticated with check (
    exists (select 1 from public.catalog_admins where email = (auth.jwt() ->> 'email'))
  );
create policy "Editors can update catalog entries" on public.catalog_items
  for update to authenticated using (
    exists (select 1 from public.catalog_admins where email = (auth.jwt() ->> 'email'))
  ) with check (
    exists (select 1 from public.catalog_admins where email = (auth.jwt() ->> 'email'))
  );
create policy "Editors can delete catalog entries" on public.catalog_items
  for delete to authenticated using (
    exists (select 1 from public.catalog_admins where email = (auth.jwt() ->> 'email'))
  );

insert into public.catalog_admins(email) values ('akimzhansagatzhan@gmail.com') on conflict do nothing;

-- Run once in the Supabase SQL Editor before deploying the team finder.
-- Telegram usernames are public so students can contact each other.
create table public.team_requests (
  event_id text not null references public.catalog_items(id) on delete cascade,
  telegram_username text not null check (telegram_username ~ '^[a-z0-9_]{5,32}$'),
  created_at timestamptz not null default now(),
  primary key (event_id, telegram_username)
);

alter table public.team_requests enable row level security;
grant select, insert on public.team_requests to anon, authenticated;

create policy "Anyone can find teammates" on public.team_requests
  for select to anon, authenticated using (true);
create policy "Anyone can join a team list" on public.team_requests
  for insert to anon, authenticated with check (true);

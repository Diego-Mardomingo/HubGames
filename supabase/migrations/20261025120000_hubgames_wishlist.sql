-- #35: wishlist de Steam con precio actual y descuento. #36: mínimo histórico de IsThereAnyDeal.

-- Juegos que el usuario quiere y aún no tiene. source = 'steam' viene de IWishlistService/GetWishlist y la sincronización
-- la reemplaza entera; 'manual' se añade desde HubGames (buscador o ficha) y solo la quita el usuario o la compra.
create table if not exists public.hubgames_user_wishlist (
  user_id uuid not null references public.hubgames_usuarios(id) on delete cascade,
  appid integer not null,
  source text not null default 'steam' check (source in ('steam', 'manual')),
  priority integer not null default 0,
  date_added timestamptz not null default now(),
  primary key (user_id, appid)
);

alter table public.hubgames_user_wishlist enable row level security;

drop policy if exists "Users can view own wishlist" on public.hubgames_user_wishlist;
create policy "Users can view own wishlist" on public.hubgames_user_wishlist
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.hubgames_user_wishlist from anon, authenticated;
grant select on public.hubgames_user_wishlist to authenticated;

-- Precio actual en la tienda de Steam (ES) y mínimos de IsThereAnyDeal, uno por juego y compartido entre usuarios.
-- Importes en céntimos. itad_id null con itad_checked_at = IsThereAnyDeal no conoce el juego (se reintenta al mes).
create table if not exists public.hubgames_game_prices (
  appid integer primary key,
  currency text,
  price_initial integer check (price_initial >= 0),
  price_final integer check (price_final >= 0),
  discount_percent smallint check (discount_percent between 0 and 100),
  price_synced_at timestamptz,
  itad_id text,
  itad_checked_at timestamptz,
  steam_low integer check (steam_low >= 0),
  steam_low_at timestamptz,
  all_low integer check (all_low >= 0),
  all_low_shop text,
  all_low_at timestamptz,
  lows_synced_at timestamptz
);

alter table public.hubgames_game_prices enable row level security;

drop policy if exists "Authenticated can view game prices" on public.hubgames_game_prices;
create policy "Authenticated can view game prices" on public.hubgames_game_prices
  for select to authenticated using (true);

revoke all on public.hubgames_game_prices from anon, authenticated;
grant select on public.hubgames_game_prices to authenticated;

-- Historial propio de precios: una fila por juego y día, solo cuando el precio cambia respecto al último conocido.
create table if not exists public.hubgames_price_snapshots (
  appid integer not null,
  date date not null,
  price_initial integer not null check (price_initial >= 0),
  price_final integer not null check (price_final >= 0),
  discount_percent smallint not null check (discount_percent between 0 and 100),
  primary key (appid, date)
);

alter table public.hubgames_price_snapshots enable row level security;

drop policy if exists "Authenticated can view price snapshots" on public.hubgames_price_snapshots;
create policy "Authenticated can view price snapshots" on public.hubgames_price_snapshots
  for select to authenticated using (true);

revoke all on public.hubgames_price_snapshots from anon, authenticated;
grant select on public.hubgames_price_snapshots to authenticated;

-- Vista de /wishlist: deseo + ficha + precios. Los juegos que ya tienes en Steam no salen aunque sigan en la tabla.
create or replace view public.hubgames_wishlist
with (security_invoker = true) as
select
  w.user_id,
  w.appid,
  w.source,
  w.priority,
  w.date_added,
  c.name,
  c.header_image,
  c.release_date,
  c.release_date_text,
  c.coming_soon,
  c.is_free,
  c.genres,
  c.steamspy_userscore,
  p.currency,
  p.price_initial,
  p.price_final,
  p.discount_percent,
  p.price_synced_at,
  p.itad_id,
  p.steam_low,
  p.steam_low_at,
  p.all_low,
  p.all_low_shop,
  p.all_low_at
from public.hubgames_user_wishlist w
left join public.hubgames_juegos_steam c on c.steam_appid = w.appid
left join public.hubgames_game_prices p on p.appid = w.appid
where not exists (
  select 1 from public.hubgames_user_steam_games s where s.user_id = w.user_id and s.appid = w.appid
);

revoke all on public.hubgames_wishlist from anon, authenticated;
grant select on public.hubgames_wishlist to authenticated;

-- Al desvincular Steam también se borra la wishlist que vino de Steam (la manual es del usuario).
create or replace function public.hubgames_user_steam_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from hubgames_user_steam_games where user_id = old.user_id;
  delete from hubgames_user_achievements where user_id = old.user_id;
  delete from hubgames_playtime_snapshots where user_id = old.user_id;
  delete from hubgames_user_wishlist where user_id = old.user_id and source = 'steam';
  return old;
end;
$$;

revoke execute on function public.hubgames_user_steam_cleanup() from public, anon, authenticated;

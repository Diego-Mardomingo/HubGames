-- Rediseño de la wishlist: la fila enseña la nota de Metacritic, la duración de la historia y el €/h, como la de un
-- pendiente sin comprar de la biblioteca. Se añaden al final de hubgames_wishlist (sin tocar las columnas de antes):
--   metacritic_score y steamspy_median_forever de hubgames_juegos_steam,
--   hltb_main / hltb_main_extra / hltb_completionist de hubgames_hltb (los mismos nombres que en hubgames_library,
--   para que gameDuration() dé la historia igual: HowLongToBeat y, si no hay, la mediana de SteamSpy).
-- Misma seguridad: security_invoker (RLS de las tablas de debajo) y el grant de select a authenticated se conserva.
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
  p.all_low_at,
  c.metacritic_score,
  c.steamspy_median_forever,
  h.main as hltb_main,
  h.main_extra as hltb_main_extra,
  h.completionist as hltb_completionist
from public.hubgames_user_wishlist w
left join public.hubgames_juegos_steam c on c.steam_appid = w.appid
left join public.hubgames_game_prices p on p.appid = w.appid
left join public.hubgames_hltb h on h.appid = w.appid
where not exists (
  select 1 from public.hubgames_user_steam_games s where s.user_id = w.user_id and s.appid = w.appid
);

grant select on public.hubgames_wishlist to authenticated;

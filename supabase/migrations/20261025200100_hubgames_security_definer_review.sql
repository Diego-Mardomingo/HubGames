-- #63 (2/2): revisión de las funciones SECURITY DEFINER que se pueden llamar por /rest/v1/rpc.
--
-- Se dejan a propósito (el advisor las seguirá marcando):
-- - is_admin(): solo dice si quien llama es admin (usa auth.uid()); la usan las políticas RLS de HubGames.
-- - hubgames_judi_search_pool(text): buscador del juego de JUDI; solo devuelve nombres del pool elegible.
-- - hubgames_judi_ranking_rows(): ranking de JUDI (solo authenticated); expone usuario y fases, no respuestas.
-- - hubgames_username_available(text) (nueva, abajo): el registro necesita saberlo sin sesión, y los usuarios ya
--   son públicos en el ranking.
--
-- No son de HubGames y no se tocan aquí: get_leaderboard_by_period, get_leaderboard_period_summaries,
-- get_user_avg_guesses y get_user_ranking_stats leen ecos_* (la otra app que comparte la base de datos).
-- Las dos get_user_* ya filtran por auth.uid(): pasar el id de otro usuario devuelve vacío.

-- hubgames_check_available(email, username) dejaba enumerar emails registrados sin sesión. Ahora solo se comprueba
-- el username; el email repetido lo detecta auth.signUp en el registro.
create or replace function public.hubgames_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.hubgames_usuarios where lower(username) = lower(btrim(p_username))
  );
$$;

revoke execute on function public.hubgames_username_available(text) from public;
grant execute on function public.hubgames_username_available(text) to anon, authenticated, service_role;

drop function if exists public.hubgames_check_available(text, text);

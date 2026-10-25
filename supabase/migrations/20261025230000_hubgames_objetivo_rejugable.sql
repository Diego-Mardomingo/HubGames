-- Objetivo "rejugable": juegos sin final (CS, RimWorld...) que se juegan por partidas, no para terminarlos. Se marca a mano.
alter table public.hubgames_user_games drop constraint if exists hubgames_user_games_goal_check;
alter table public.hubgames_user_games
  add constraint hubgames_user_games_goal_check check (goal in ('historia', 'extras', 'completo', 'rejugable'));

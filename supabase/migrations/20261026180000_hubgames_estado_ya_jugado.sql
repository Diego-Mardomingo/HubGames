-- Dos estados nuevos para los juegos de la biblioteca:
--   'ya_jugado': jugados antes de usar HubGames (o sin seguimiento) que no quieres clasificar como Completado ni Abandonado.
--   'otros': cajón de sastre para lo que no encaja en ninguna lista (software, demos, betas, bandas sonoras, juegos de servicio...).
-- Ninguno cuenta como completado (estadísticas, metas, rachas) y las reglas automáticas no los tocan (estados cerrados).
-- El estado solo se valida con este check: ni enums, ni funciones, ni vistas enumeran los estados.
alter table public.hubgames_user_games drop constraint if exists hubgames_user_games_status_check;
alter table public.hubgames_user_games
  add constraint hubgames_user_games_status_check
  check (status in ('bandeja', 'pendiente', 'jugando', 'pausado', 'completado', 'abandonado', 'descartado', 'ya_jugado', 'otros'));

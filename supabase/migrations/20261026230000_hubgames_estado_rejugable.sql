-- Estado nuevo para los juegos de la biblioteca:
--   'rejugable': juegos vivos de partidas sueltas, sin un final que perseguir, a los que vuelves de vez en cuando
--   (CS2, Project Zomboid, Path of Exile 2, BattleBit Remastered...). Es una lista activa: sale en «Todos».
-- No cuenta como completado (estadísticas, metas, rachas) y las reglas automáticas no lo tocan: jugarlo no lo pasa a
-- Jugando ni genera sugerencias.
-- El estado solo se valida con este check: ni enums, ni funciones, ni vistas enumeran los estados.
alter table public.hubgames_user_games drop constraint if exists hubgames_user_games_status_check;
alter table public.hubgames_user_games
  add constraint hubgames_user_games_status_check
  check (status in ('bandeja', 'pendiente', 'jugando', 'pausado', 'completado', 'abandonado', 'descartado', 'ya_jugado', 'otros', 'rejugable'));

-- #8: hubgames_judi_pool guarda la fecha de selección de los próximos juegos de JUDI,
-- así que deja de ser de lectura pública. El buscador usa hubgames_judi_search_pool().
drop policy if exists "hubgames_judi_pool_public_read" on public.hubgames_judi_pool;
create policy "Admins can view JUDI pool" on public.hubgames_judi_pool
  for select to authenticated using (public.is_admin());
revoke select on public.hubgames_judi_pool from anon;

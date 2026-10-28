-- Rediseño de JUDI: cada intento en su orden, también los saltos, y sin borrar los fallos al acertar.
--
-- - hubgames_judi_intentos.intento pasa a admitir null: una fila con intento null es un salto. La restricción única
--   (id_lista_judi, id_usuario, intento) no choca con varios saltos (null no es igual a null).
-- - hubgames_judi_get_day devuelve además `attempts`: todos los intentos en orden (texto = fallo, null = salto).
--   `guesses` sigue igual (solo los nombres), para que el cliente anterior funcione.
-- - hubgames_judi_guess guarda el salto como fila y ya no borra los intentos al acertar.
--
-- La puntuación no cambia: el ranking, el perfil, la navegación y el historial leen completado + fase1..fase6 de
-- hubgames_judi_fases_usuario, y esta migración no toca esa tabla ni cómo se marcan las fases.
-- No cambia datos existentes: las partidas anteriores no tienen sus saltos ni (si se acertaron) sus fallos; el cliente
-- lo detecta (menos intentos que fallos) y los enseña sin orden.
--
-- Revertir: volver a aplicar hubgames_judi_get_day y hubgames_judi_guess de 20261025210000_hubgames_judi_servidor.sql,
-- `delete from public.hubgames_judi_intentos where intento is null;` y
-- `alter table public.hubgames_judi_intentos alter column intento set not null;`.

alter table public.hubgames_judi_intentos alter column intento drop not null;

-- Con sesión, la fase sale de tu progreso guardado (p_phase se ignora). Sin sesión, de p_phase (localStorage).
create or replace function public.hubgames_judi_get_day(p_id bigint, p_phase integer default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_progress public.hubgames_judi_fases_usuario;
  v_state text := 'playing';
  v_phase integer;
  v_guesses jsonb := '[]'::jsonb;
  v_attempts jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    return public.hubgames_judi_day_payload(p_id, least(greatest(coalesce(p_phase, 1), 1), 6), false)
      || jsonb_build_object('state', 'playing', 'failed', null, 'guesses', null, 'attempts', null);
  end if;

  select * into v_progress from public.hubgames_judi_fases_usuario where id_lista_judi = p_id and id_usuario = v_uid;
  v_phase := coalesce(public.hubgames_judi_phase(v_progress), 1);
  if v_progress.completado then v_state := 'won'; elsif v_progress.fase6 then v_state := 'lost'; end if;

  select coalesce(jsonb_agg(intento order by id) filter (where intento is not null), '[]'::jsonb),
         coalesce(jsonb_agg(intento order by id), '[]'::jsonb)
  into v_guesses, v_attempts
  from public.hubgames_judi_intentos where id_lista_judi = p_id and id_usuario = v_uid;

  return public.hubgames_judi_day_payload(p_id, v_phase, v_state <> 'playing')
    || jsonb_build_object(
      'state', v_state,
      'failed', (coalesce(v_progress.fase1, false)::int + coalesce(v_progress.fase2, false)::int
        + coalesce(v_progress.fase3, false)::int + coalesce(v_progress.fase4, false)::int
        + coalesce(v_progress.fase5, false)::int + coalesce(v_progress.fase6, false)::int),
      'guesses', v_guesses,
      'attempts', v_attempts
    );
end;
$$;

-- p_guess null o vacío = saltar intento. Fallar o saltar marca la fase actual (y guarda el intento, null si es un
-- salto); fallar en la 6 la pierde. Acertar marca completado y deja los intentos como estaban.
create or replace function public.hubgames_judi_guess(p_id bigint, p_guess text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_day public.hubgames_lista_videojuegos_judi;
  v_progress public.hubgames_judi_fases_usuario;
  v_phase integer;
  v_guess text := nullif(btrim(coalesce(p_guess, '')), '');
begin
  if v_uid is null then
    raise exception 'Inicia sesión para guardar tu partida' using errcode = '42501';
  end if;
  v_day := public.hubgames_judi_published(p_id);
  if v_day.id is null then
    raise exception 'JUDI no disponible' using errcode = 'P0002';
  end if;

  insert into public.hubgames_judi_fases_usuario (id_lista_judi, id_usuario)
  values (p_id, v_uid)
  on conflict (id_lista_judi, id_usuario) do nothing;

  select * into v_progress from public.hubgames_judi_fases_usuario
  where id_lista_judi = p_id and id_usuario = v_uid
  for update;

  if v_progress.completado or v_progress.fase6 then
    return public.hubgames_judi_get_day(p_id) || jsonb_build_object('result', 'finished');
  end if;
  v_phase := public.hubgames_judi_phase(v_progress);

  if v_guess is not null and public.hubgames_judi_normalize(v_guess) = public.hubgames_judi_normalize(v_day.nombre) then
    update public.hubgames_judi_fases_usuario
    set completado = true, fecha_completado = now()
    where id_lista_judi = p_id and id_usuario = v_uid;
    return public.hubgames_judi_get_day(p_id) || jsonb_build_object('result', 'correct');
  end if;

  if v_guess is not null then
    if exists (
      select 1 from public.hubgames_judi_intentos
      where id_lista_judi = p_id and id_usuario = v_uid and intento is not null
        and public.hubgames_judi_normalize(intento) = public.hubgames_judi_normalize(v_guess)
    ) then
      return public.hubgames_judi_get_day(p_id) || jsonb_build_object('result', 'duplicate');
    end if;
    insert into public.hubgames_judi_intentos (id_lista_judi, id_usuario, intento)
    values (p_id, v_uid, v_guess)
    on conflict do nothing;
  else
    insert into public.hubgames_judi_intentos (id_lista_judi, id_usuario, intento)
    values (p_id, v_uid, null);
  end if;

  update public.hubgames_judi_fases_usuario
  set fase1 = coalesce(fase1, false) or v_phase = 1,
      fase2 = coalesce(fase2, false) or v_phase = 2,
      fase3 = coalesce(fase3, false) or v_phase = 3,
      fase4 = coalesce(fase4, false) or v_phase = 4,
      fase5 = coalesce(fase5, false) or v_phase = 5,
      fase6 = coalesce(fase6, false) or v_phase = 6,
      fecha_completado = case when v_phase = 6 then now() else fecha_completado end
  where id_lista_judi = p_id and id_usuario = v_uid;

  return public.hubgames_judi_get_day(p_id) || jsonb_build_object('result', case when v_guess is null then 'skipped' else 'wrong' end);
end;
$$;

-- Mismos permisos que antes (create or replace los conserva; se repiten por claridad).
revoke execute on function public.hubgames_judi_get_day(bigint, integer) from public;
grant execute on function public.hubgames_judi_get_day(bigint, integer) to anon, authenticated, service_role;
revoke execute on function public.hubgames_judi_guess(bigint, text) from public, anon;
grant execute on function public.hubgames_judi_guess(bigint, text) to authenticated, service_role;

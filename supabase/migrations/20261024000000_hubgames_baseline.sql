-- Migración base de HubGames: describe el estado actual (24-10-2026) de los objetos hubgames_*.
--
-- La base de datos de Supabase es COMPARTIDA con ECOS: aquí no hay ningún objeto ecos_* ni las funciones
-- get_* de ranking, que pertenecen a ECOS. `is_admin()` es de HubGames.
-- La base de producción ya tiene todo esto aplicado; este archivo sirve para reproducir y revisar el esquema.
-- Los cambios nuevos van en migraciones posteriores (ver README).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ─── Secuencias ──────────────────────────────────────────────────────────────
create sequence if not exists public.hubgames_judi_generacion_logs_id_seq;
create sequence if not exists public.hubgames_judi_intentos_id_seq;
create sequence if not exists public.hubgames_judi_pool_id_seq;
create sequence if not exists public.hubgames_lista_videojuegos_judi_id_seq;

-- ─── Tablas ──────────────────────────────────────────────────────────────────
create table if not exists public.hubgames_usuarios (
  id uuid not null default gen_random_uuid(),
  username text not null,
  email text not null,
  password_hash text,
  email_verificado boolean not null default false,
  fecha_creacion timestamptz not null default now(),
  cuenta_google boolean not null default false,
  administrador boolean not null default false
);

create table if not exists public.hubgames_lista_videojuegos_judi (
  id bigint not null default nextval('hubgames_lista_videojuegos_judi_id_seq'::regclass),
  id_videojuego integer not null,
  nombre text not null,
  fecha text not null, -- DD-MM-YYYY
  calificacion integer not null,
  desarrollador text not null,
  released text not null,
  steam_appid integer,
  data_source text not null default 'rawg'
);

create table if not exists public.hubgames_judi_fases_usuario (
  id_lista_judi bigint not null,
  id_usuario uuid not null,
  completado boolean not null default false,
  fecha_completado timestamptz,
  fase1 boolean not null default false,
  fase2 boolean not null default false,
  fase3 boolean not null default false,
  fase4 boolean not null default false,
  fase5 boolean not null default false,
  fase6 boolean not null default false,
  fase7 boolean not null default false
);

create table if not exists public.hubgames_judi_intentos (
  id bigint not null default nextval('hubgames_judi_intentos_id_seq'::regclass),
  id_lista_judi bigint not null,
  id_usuario uuid not null,
  intento text not null,
  created_at timestamptz default now()
);

create table if not exists public.hubgames_judi_generacion_logs (
  id bigint not null default nextval('hubgames_judi_generacion_logs_id_seq'::regclass),
  fecha_ejecucion timestamptz default now(),
  exito boolean not null,
  error_mensaje text,
  error_stack text,
  id_juego_rawg integer,
  nombre_juego text,
  fecha_judi text,
  id_juego_steam integer,
  fuente text
);

create table if not exists public.hubgames_juegos_steam (
  steam_appid integer not null,
  name text not null,
  type text,
  required_age integer,
  is_free boolean default false,
  short_description text,
  detailed_description text,
  about_the_game text,
  supported_languages text,
  developers text[] default '{}'::text[],
  publishers text[] default '{}'::text[],
  website text,
  header_image text,
  capsule_image text,
  capsule_imagev5 text,
  background text,
  background_raw text,
  release_date_text text,
  release_date date,
  coming_soon boolean,
  metacritic_score integer,
  metacritic_url text,
  categories jsonb default '[]'::jsonb,
  genres jsonb default '[]'::jsonb,
  screenshots jsonb default '[]'::jsonb,
  movies jsonb default '[]'::jsonb,
  price_overview jsonb,
  packages jsonb,
  platforms jsonb,
  recommendations_total integer,
  achievements_total integer,
  steamspy_score_rank integer,
  steamspy_positive integer,
  steamspy_negative integer,
  steamspy_userscore integer,
  steamspy_owners text,
  steamspy_average_forever integer,
  steamspy_average_2weeks integer,
  steamspy_median_forever integer,
  steamspy_median_2weeks integer,
  steamspy_ccu integer,
  steamspy_tags jsonb,
  steamspy_raw jsonb,
  steam_web_raw jsonb,
  steam_store_raw jsonb,
  source_priority integer default 0,
  last_synced_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.hubgames_judi_pool (
  id bigint not null default nextval('hubgames_judi_pool_id_seq'::regclass),
  week_start_date date not null,
  week_end_date date not null,
  steam_appid integer not null,
  game_name text not null,
  relevance_score numeric(10,2) not null default 0,
  is_eligible boolean not null default false,
  eligibility_reasons text[] default '{}'::text[],
  filter_reviews_min_pass boolean not null default false,
  filter_screenshots_pass boolean not null default false,
  filter_positive_score_pass boolean not null default false,
  filter_metadata_complete_pass boolean not null default false,
  selected_for_daily boolean not null default false,
  selected_daily_date date,
  selected_daily_list_id bigint,
  discarded boolean not null default false,
  discarded_reason text,
  source_tag text not null default 'steam_weekly',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hubgames_push_subscriptions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  subscription jsonb not null,
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.hubgames_capturas (
  captura varchar(255) not null,
  id_videojuego integer
);

create table if not exists public.hubgames_generos (
  genero varchar(255) not null
);

create table if not exists public.hubgames_plataformas (
  plataforma varchar(255) not null
);

create table if not exists public.hubgames_videojuego_genero (
  id_videojuego integer not null,
  genero varchar(255) not null
);

create table if not exists public.hubgames_videojuego_plataforma (
  id_videojuego integer not null,
  plataforma varchar(255) not null
);

alter sequence public.hubgames_judi_generacion_logs_id_seq owned by public.hubgames_judi_generacion_logs.id;
alter sequence public.hubgames_judi_intentos_id_seq owned by public.hubgames_judi_intentos.id;
alter sequence public.hubgames_judi_pool_id_seq owned by public.hubgames_judi_pool.id;
alter sequence public.hubgames_lista_videojuegos_judi_id_seq owned by public.hubgames_lista_videojuegos_judi.id;

-- ─── Claves primarias y únicas ───────────────────────────────────────────────
alter table public.hubgames_capturas add constraint hubgames_capturas_pkey primary key (captura);
alter table public.hubgames_generos add constraint hubgames_generos_pkey primary key (genero);
alter table public.hubgames_judi_fases_usuario add constraint hubgames_judi_fases_usuario_pkey primary key (id_lista_judi, id_usuario);
alter table public.hubgames_judi_generacion_logs add constraint hubgames_judi_generacion_logs_pkey primary key (id);
alter table public.hubgames_judi_intentos add constraint hubgames_judi_intentos_pkey primary key (id);
alter table public.hubgames_judi_pool add constraint hubgames_judi_pool_pkey primary key (id);
alter table public.hubgames_juegos_steam add constraint hubgames_juegos_steam_pkey primary key (steam_appid);
alter table public.hubgames_lista_videojuegos_judi add constraint hubgames_lista_videojuegos_judi_pkey primary key (id);
alter table public.hubgames_plataformas add constraint hubgames_plataformas_pkey primary key (plataforma);
alter table public.hubgames_push_subscriptions add constraint hubgames_push_subscriptions_pkey primary key (id);
alter table public.hubgames_usuarios add constraint hubgames_usuarios_pkey primary key (id);
alter table public.hubgames_videojuego_genero add constraint hubgames_videojuego_genero_pkey primary key (id_videojuego, genero);
alter table public.hubgames_videojuego_plataforma add constraint hubgames_videojuego_plataforma_pkey primary key (id_videojuego, plataforma);

alter table public.hubgames_judi_intentos add constraint hubgames_judi_intentos_id_lista_judi_id_usuario_intento_key unique (id_lista_judi, id_usuario, intento);
alter table public.hubgames_judi_pool add constraint hubgames_judi_pool_week_start_date_steam_appid_key unique (week_start_date, steam_appid);
alter table public.hubgames_lista_videojuegos_judi add constraint hubgames_lista_videojuegos_judi_fecha_key unique (fecha);
alter table public.hubgames_lista_videojuegos_judi add constraint hubgames_lista_videojuegos_judi_id_videojuego_key unique (id_videojuego);
alter table public.hubgames_lista_videojuegos_judi add constraint hubgames_lista_videojuegos_judi_nombre_key unique (nombre);
alter table public.hubgames_push_subscriptions add constraint hubgames_push_subscriptions_user_id_unique unique (user_id);
alter table public.hubgames_usuarios add constraint hubgames_usuarios_email_key unique (email);

-- ─── Claves foráneas ─────────────────────────────────────────────────────────
alter table public.hubgames_capturas add constraint hubgames_capturas_id_videojuego_fkey foreign key (id_videojuego) references public.hubgames_lista_videojuegos_judi(id_videojuego) on update cascade on delete cascade;
alter table public.hubgames_judi_fases_usuario add constraint hubgames_judi_fases_usuario_id_lista_judi_fkey foreign key (id_lista_judi) references public.hubgames_lista_videojuegos_judi(id) on update cascade on delete cascade;
alter table public.hubgames_judi_fases_usuario add constraint hubgames_judi_fases_usuario_id_usuario_fkey foreign key (id_usuario) references public.hubgames_usuarios(id) on update cascade;
alter table public.hubgames_judi_intentos add constraint hubgames_judi_intentos_id_lista_judi_fkey foreign key (id_lista_judi) references public.hubgames_lista_videojuegos_judi(id) on delete cascade;
alter table public.hubgames_judi_intentos add constraint hubgames_judi_intentos_id_usuario_fkey foreign key (id_usuario) references public.hubgames_usuarios(id) on delete cascade;
alter table public.hubgames_judi_pool add constraint hubgames_judi_pool_steam_appid_fkey foreign key (steam_appid) references public.hubgames_juegos_steam(steam_appid) on delete cascade;
alter table public.hubgames_push_subscriptions add constraint hubgames_push_subscriptions_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.hubgames_videojuego_genero add constraint hubgames_videojuego_genero_genero_fkey foreign key (genero) references public.hubgames_generos(genero) on update cascade;
alter table public.hubgames_videojuego_genero add constraint hubgames_videojuego_genero_id_videojuego_fkey foreign key (id_videojuego) references public.hubgames_lista_videojuegos_judi(id_videojuego) on update cascade on delete cascade;
alter table public.hubgames_videojuego_plataforma add constraint hubgames_videojuego_plataforma_id_videojuego_fkey foreign key (id_videojuego) references public.hubgames_lista_videojuegos_judi(id_videojuego) on update cascade on delete cascade;
alter table public.hubgames_videojuego_plataforma add constraint hubgames_videojuego_plataforma_plataforma_fkey foreign key (plataforma) references public.hubgames_plataformas(plataforma) on update cascade;

-- ─── Índices ─────────────────────────────────────────────────────────────────
create index if not exists hubgames_judi_pool_eligible_idx on public.hubgames_judi_pool using btree (week_start_date desc, is_eligible, selected_for_daily, discarded);
create index if not exists hubgames_judi_pool_score_idx on public.hubgames_judi_pool using btree (relevance_score desc);
create index if not exists hubgames_judi_pool_week_idx on public.hubgames_judi_pool using btree (week_start_date desc);
create index if not exists hubgames_juegos_steam_metacritic_idx on public.hubgames_juegos_steam using btree (metacritic_score desc);
create index if not exists hubgames_juegos_steam_release_date_idx on public.hubgames_juegos_steam using btree (release_date desc);
create index if not exists hubgames_juegos_steam_updated_idx on public.hubgames_juegos_steam using btree (updated_at desc);
create index if not exists hubgames_lista_videojuegos_judi_steam_appid_idx on public.hubgames_lista_videojuegos_judi using btree (steam_appid);
create index if not exists hubgames_push_subscriptions_enabled_idx on public.hubgames_push_subscriptions using btree (enabled);
create index if not exists hubgames_push_subscriptions_user_id_idx on public.hubgames_push_subscriptions using btree (user_id);
create index if not exists idx_hubgames_capturas_videojuego on public.hubgames_capturas using btree (id_videojuego);
create index if not exists idx_hubgames_judi_fases_usuario on public.hubgames_judi_fases_usuario using btree (id_usuario);
create index if not exists idx_hubgames_judi_videojuego on public.hubgames_lista_videojuegos_judi using btree (id_videojuego);
create index if not exists idx_hubgames_usuarios_email on public.hubgames_usuarios using btree (email);
create index if not exists idx_hubgames_vj_gen_videojuego on public.hubgames_videojuego_genero using btree (id_videojuego);
create index if not exists idx_hubgames_vj_plat_videojuego on public.hubgames_videojuego_plataforma using btree (id_videojuego);
create index if not exists idx_judi_intentos_user_game on public.hubgames_judi_intentos using btree (id_usuario, id_lista_judi);

-- ─── Funciones ───────────────────────────────────────────────────────────────
create or replace function public.hubgames_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from hubgames_usuarios
    where id = auth.uid() and administrador = true
  );
end;
$$;

-- Alta del perfil de HubGames al crearse un usuario en auth.users (registro con email o Google).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_google boolean;
begin
  is_google := (new.raw_app_meta_data->>'provider' = 'google')
    or coalesce(new.raw_app_meta_data->'providers' ? 'google', false);

  insert into public.hubgames_usuarios (
    id, email, username, email_verificado, cuenta_google, fecha_creacion, administrador, password_hash
  )
  values (
    new.id,
    new.email,
    coalesce(
      nullif(btrim(new.raw_user_meta_data->>'username'), ''),
      nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data->>'name'), ''),
      split_part(new.email, '@', 1)
    ),
    true,
    is_google,
    now(),
    false,
    null
  )
  on conflict do nothing;
  return new;
end;
$$;

-- Comprobar si un email o username está libre (lo único que ve un anónimo del registro).
create or replace function public.hubgames_check_available(p_email text, p_username text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'email_taken', exists (
      select 1 from public.hubgames_usuarios where lower(email) = lower(btrim(p_email))
    ),
    'username_taken', exists (
      select 1 from public.hubgames_usuarios where lower(username) = lower(btrim(p_username))
    )
  );
$$;

-- Ranking de JUDI sin exponer la tabla de progreso ni los emails.
create or replace function public.hubgames_judi_ranking_rows()
returns table (
  id_usuario uuid, username text, completado boolean,
  fase1 boolean, fase2 boolean, fase3 boolean, fase4 boolean, fase5 boolean, fase6 boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id_usuario, u.username, f.completado,
         f.fase1, f.fase2, f.fase3, f.fase4, f.fase5, f.fase6
  from public.hubgames_judi_fases_usuario f
  left join public.hubgames_usuarios u on u.id = f.id_usuario
  where auth.uid() is not null and (f.completado or f.fase6)
  order by f.id_lista_judi, f.id_usuario;
$$;

-- Buscador de JUDI sin exponer la tabla del pool (tiene las respuestas de los próximos días).
create or replace function public.hubgames_judi_search_pool(p_query text)
returns table (steam_appid integer, game_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.steam_appid, p.game_name
  from public.hubgames_judi_pool p
  where p.is_eligible and not p.discarded
    and not exists (
      select 1
      from unnest(string_to_array(lower(btrim(coalesce(p_query, ''))), ' ')) t
      where t <> ''
        and p.game_name not ilike '%' || replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
    and btrim(coalesce(p_query, '')) <> ''
  order by p.relevance_score desc
  limit 14;
$$;

-- Aviso push diario de JUDI (lo invoca pg_cron; la clave es la anon pública).
create or replace function public.run_judi_daily_notification()
returns void
language plpgsql
security definer
set "TimeZone" to 'Europe/Madrid'
as $$
declare
  hour_madrid int;
  minute_madrid int;
begin
  select
    extract(hour from (current_timestamp at time zone 'Europe/Madrid'))::int,
    extract(minute from (current_timestamp at time zone 'Europe/Madrid'))::int
  into hour_madrid, minute_madrid;

  if hour_madrid = 17 and minute_madrid = 0 then
    perform net.http_post(
      url := 'https://hrpwtsnsxnogjpsxslwi.supabase.co/functions/v1/send_daily_judi_notifications',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhycHd0c25zeG5vZ2pwc3hzbHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjg3MzkyODIsImV4cCI6MjA0NDMxNTI4Mn0.AHcmvmsvASWp5ficQakeM6SIZJyxYMTd1_4-God40lg"}'::jsonb,
      body := '{}'::jsonb
    );
  end if;
end;
$$;

-- ─── Triggers ────────────────────────────────────────────────────────────────
drop trigger if exists hubgames_juegos_steam_set_updated_at on public.hubgames_juegos_steam;
create trigger hubgames_juegos_steam_set_updated_at
  before update on public.hubgames_juegos_steam
  for each row execute function public.hubgames_set_updated_at();

drop trigger if exists hubgames_judi_pool_set_updated_at on public.hubgames_judi_pool;
create trigger hubgames_judi_pool_set_updated_at
  before update on public.hubgames_judi_pool
  for each row execute function public.hubgames_set_updated_at();

drop trigger if exists on_hubgames_auth_user_created on auth.users;
create trigger on_hubgames_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.hubgames_capturas enable row level security;
alter table public.hubgames_generos enable row level security;
alter table public.hubgames_judi_fases_usuario enable row level security;
alter table public.hubgames_judi_generacion_logs enable row level security;
alter table public.hubgames_judi_intentos enable row level security;
alter table public.hubgames_judi_pool enable row level security;
alter table public.hubgames_juegos_steam enable row level security;
alter table public.hubgames_lista_videojuegos_judi enable row level security;
alter table public.hubgames_plataformas enable row level security;
alter table public.hubgames_push_subscriptions enable row level security;
alter table public.hubgames_usuarios enable row level security;
alter table public.hubgames_videojuego_genero enable row level security;
alter table public.hubgames_videojuego_plataforma enable row level security;

-- Catálogo público
create policy "Anyone can view screenshots" on public.hubgames_capturas for select to public using (true);
create policy "Anyone can view genres" on public.hubgames_generos for select to public using (true);
create policy "Anyone can view platforms" on public.hubgames_plataformas for select to public using (true);
create policy "Anyone can view game genres" on public.hubgames_videojuego_genero for select to public using (true);
create policy "Anyone can view game platforms" on public.hubgames_videojuego_plataforma for select to public using (true);
create policy "hubgames_juegos_steam_public_read" on public.hubgames_juegos_steam for select to anon, authenticated using (true);

-- Usuarios: cada uno ve su fila y solo cambia su username (ver también los grants)
create policy "Users can view own profile" on public.hubgames_usuarios
  for select to authenticated using (auth.uid() = id);
create policy "Users can update own username" on public.hubgames_usuarios
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- JUDI
create policy "Public can view released JUDI games" on public.hubgames_lista_videojuegos_judi
  for select to anon, authenticated
  using (to_date(fecha, 'DD-MM-YYYY') <= (now() at time zone 'Europe/Madrid')::date);
create policy "Admins can view all JUDI games" on public.hubgames_lista_videojuegos_judi
  for select to authenticated using (public.is_admin());

create policy "Users can view own progress" on public.hubgames_judi_fases_usuario
  for select to authenticated using (auth.uid() = id_usuario);
create policy "Users can insert own progress" on public.hubgames_judi_fases_usuario
  for insert to public with check (auth.uid() = id_usuario);
create policy "Users can update own progress" on public.hubgames_judi_fases_usuario
  for update to public using (auth.uid() = id_usuario);

create policy "Users can read own attempts" on public.hubgames_judi_intentos
  for select to public using (auth.uid() = id_usuario);
create policy "Users can insert own attempts" on public.hubgames_judi_intentos
  for insert to public with check (auth.uid() = id_usuario);
create policy "Users can delete own attempts" on public.hubgames_judi_intentos
  for delete to public using (auth.uid() = id_usuario);

create policy "Admins can read judi generacion logs" on public.hubgames_judi_generacion_logs
  for select to authenticated using (public.is_admin());

-- Pool: de momento lectura pública (lo lee el buscador de JUDI). Se cierra a admin en la migración siguiente.
create policy "hubgames_judi_pool_public_read" on public.hubgames_judi_pool
  for select to anon, authenticated using (true);

create policy "Users manage own push subscriptions" on public.hubgames_push_subscriptions
  for all to public using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Privilegios ─────────────────────────────────────────────────────────────
-- RLS decide las filas; aquí se dejan solo los privilegios que se usan.
revoke all on
  public.hubgames_capturas, public.hubgames_generos, public.hubgames_judi_fases_usuario,
  public.hubgames_judi_generacion_logs, public.hubgames_judi_intentos, public.hubgames_judi_pool,
  public.hubgames_juegos_steam, public.hubgames_lista_videojuegos_judi, public.hubgames_plataformas,
  public.hubgames_push_subscriptions, public.hubgames_usuarios, public.hubgames_videojuego_genero,
  public.hubgames_videojuego_plataforma
from anon, authenticated;

grant select on
  public.hubgames_capturas, public.hubgames_generos, public.hubgames_judi_generacion_logs,
  public.hubgames_judi_pool, public.hubgames_juegos_steam, public.hubgames_lista_videojuegos_judi,
  public.hubgames_plataformas, public.hubgames_videojuego_genero, public.hubgames_videojuego_plataforma
to anon, authenticated;

grant select on public.hubgames_usuarios to authenticated;
grant update (username) on public.hubgames_usuarios to authenticated;
grant select, insert, update on public.hubgames_judi_fases_usuario to authenticated;
grant select, insert, delete on public.hubgames_judi_intentos to authenticated;
grant select, insert, update, delete on public.hubgames_push_subscriptions to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.hubgames_check_available(text, text) from public;
grant execute on function public.hubgames_check_available(text, text) to anon, authenticated;
revoke all on function public.hubgames_judi_ranking_rows() from public, anon;
grant execute on function public.hubgames_judi_ranking_rows() to authenticated;
revoke all on function public.hubgames_judi_search_pool(text) from public;
grant execute on function public.hubgames_judi_search_pool(text) to anon, authenticated;

-- ─── Cron ────────────────────────────────────────────────────────────────────
select cron.schedule(
  'judi-daily-notifications-17h-spain',
  '0 16 * * *',
  $cron$
    select
      net.http_post(
          url:='https://hrpwtsnsxnogjpsxslwi.supabase.co/functions/v1/send_daily_judi_notifications',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhycHd0c25zeG5vZ2pwc3hzbHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjg3MzkyODIsImV4cCI6MjA0NDMxNTI4Mn0.AHcmvmsvASWp5ficQakeM6SIZJyxYMTd1_4-God40lg"}'::jsonb
      ) as request_id;
  $cron$
);

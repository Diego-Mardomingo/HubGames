import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ""

function formatYmdMadrid(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function toLegacyDate(date: Date): string {
  const ymd = formatYmdMadrid(date)
  const [y, m, d] = ymd.split('-')
  return `${d}-${m}-${y}`
}

function mapPlatforms(platforms: Record<string, boolean> | null | undefined): string[] {
  if (!platforms) return []
  const result: string[] = []
  if (platforms.windows) result.push('PC (Windows)')
  if (platforms.mac) result.push('Mac')
  if (platforms.linux) result.push('Linux')
  return result
}

function mapGenres(genres: Array<{ description?: string }> | null | undefined): string[] {
  return (genres || [])
    .map((genre) => genre?.description?.trim())
    .filter((genre): genre is string => Boolean(genre))
}

serve(async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ success: false, error: 'Supabase config incomplete' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const now = new Date()
  const formattedDate = toLegacyDate(now)
  const isoToday = formatYmdMadrid(now)

  try {
    const { data: existingDaily } = await supabase
      .from('hubgames_lista_videojuegos_judi')
      .select('id, nombre')
      .eq('fecha', formattedDate)
      .maybeSingle()

    if (existingDaily) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: 'Game already exists for today', game: existingDaily.nombre }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { data: candidates, error: candidatesError } = await supabase
      .from('hubgames_judi_pool')
      .select('id, steam_appid, game_name')
      .eq('is_eligible', true)
      .eq('selected_for_daily', false)
      .eq('discarded', false)
      .order('relevance_score', { ascending: false })
      .limit(25)

    if (candidatesError || !candidates || candidates.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No eligible games found in hubgames_judi_pool' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    for (const candidate of candidates) {
      const { data: steamGame } = await supabase
        .from('hubgames_juegos_steam')
        .select('*')
        .eq('steam_appid', candidate.steam_appid)
        .maybeSingle()

      if (!steamGame) continue

      const popularity = steamGame.steamspy_userscore
        ? (Number(steamGame.steamspy_userscore) / 20).toFixed(1)
        : '0'

      const { data: insertedGame, error: insertError } = await supabase
        .from('hubgames_lista_videojuegos_judi')
        .insert({
          id_videojuego: candidate.steam_appid,
          steam_appid: candidate.steam_appid,
          data_source: 'steam_pool',
          nombre: steamGame.name,
          fecha: formattedDate,
          calificacion: steamGame.metacritic_score || 0,
          desarrollador: popularity,
          released: steamGame.release_date || steamGame.release_date_text || '',
        })
        .select('id')
        .single()

      if (insertError) {
        if (insertError.message?.includes('duplicate key value') || insertError.message?.includes('unique')) {
          await supabase
            .from('hubgames_judi_pool')
            .update({
              discarded: true,
              discarded_reason: 'already_used_in_daily_history',
            })
            .eq('id', candidate.id)
          continue
        }
        return new Response(JSON.stringify({ success: false, error: insertError.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const platforms = mapPlatforms(steamGame.platforms)
      for (const platform of platforms) {
        await supabase.from('hubgames_plataformas').upsert({ plataforma: platform })
        await supabase.from('hubgames_videojuego_plataforma').upsert({
          id_videojuego: candidate.steam_appid,
          plataforma: platform,
        })
      }

      const genres = mapGenres(steamGame.genres)
      for (const genre of genres) {
        await supabase.from('hubgames_generos').upsert({ genero: genre })
        await supabase.from('hubgames_videojuego_genero').upsert({
          id_videojuego: candidate.steam_appid,
          genero: genre,
        })
      }

      const screenshots = (steamGame.screenshots || [])
        .slice(0, 7)
        .map((shot: { path_full?: string }) => shot.path_full)
        .filter((path: string | undefined): path is string => Boolean(path))
        .map((path: string) => ({ id_videojuego: candidate.steam_appid, captura: path }))

      if (screenshots.length > 0) {
        await supabase.from('hubgames_capturas').upsert(screenshots)
      }

      await supabase
        .from('hubgames_judi_pool')
        .update({
          selected_for_daily: true,
          selected_daily_date: isoToday,
          selected_daily_list_id: insertedGame.id,
        })
        .eq('id', candidate.id)

      await supabase.from('hubgames_judi_generacion_logs').insert({
        exito: true,
        id_juego_steam: candidate.steam_appid,
        nombre_juego: candidate.game_name,
        fecha_judi: formattedDate,
        fuente: 'steam_pool_edge_function',
      })

      return new Response(JSON.stringify({
        success: true,
        game: candidate.game_name,
        source: 'steam_pool',
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(
      JSON.stringify({ success: false, error: 'No candidate could be inserted into daily list' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    await supabase.from('hubgames_judi_generacion_logs').insert({
      exito: false,
      error_mensaje: error?.message || 'Unknown error',
      error_stack: error?.stack || null,
      fecha_judi: formattedDate,
      fuente: 'steam_pool_edge_function',
    })

    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

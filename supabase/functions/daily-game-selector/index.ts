import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RAWG_API_KEY = Deno.env.get('RAWG_API_KEY') ?? ""
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ""

type LogEntry = {
  exito: boolean
  error_mensaje?: string
  error_stack?: string
  id_juego_rawg?: number
  nombre_juego?: string
  fecha_judi?: string
}

async function registrarLog(supabase: any, entry: LogEntry): Promise<number | null> {
  const { data, error } = await supabase
    .from('hubgames_judi_generacion_logs')
    .insert(entry)
    .select('id')
    .single()
  if (error) {
    console.error('[JUDI] Error registrando log:', error.message)
    return null
  }
  return data?.id ?? null
}

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const today = new Date().toISOString().split('T')[0]
  const [year, month, day] = today.split('-')
  const formattedDate = `${day}-${month}-${year}`

  try {
    // 1. Verificar si ya existe el juego de hoy
    const { data: existente } = await supabase
      .from('hubgames_lista_videojuegos_judi')
      .select('id, id_videojuego, nombre')
      .eq('fecha', formattedDate)
      .maybeSingle()

    if (existente) {
      const logId = await registrarLog(supabase, {
        exito: true,
        id_juego_rawg: existente.id_videojuego,
        nombre_juego: existente.nombre,
        fecha_judi: formattedDate,
      })
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        message: "Game already exists for today",
        game: existente.nombre,
        log_id: logId,
      }), { headers: { "Content-Type": "application/json" } })
    }

    // 2. Obtener juego aleatorio (excluyendo ya usados)
    const { data: juegosExistentes } = await supabase
      .from('hubgames_lista_videojuegos_judi')
      .select('id_videojuego')
    const idsExcluidos = new Set((juegosExistentes || []).map((r: any) => r.id_videojuego))

    const game = await obtenerJuegoRandom(idsExcluidos)
    if (!game) {
      const logId = await registrarLog(supabase, {
        exito: false,
        error_mensaje: "No suitable random game found after 20 attempts",
        fecha_judi: formattedDate,
      })
      return new Response(JSON.stringify({
        success: false,
        error: "Could not find a suitable random game",
        log_id: logId,
      }), { status: 500, headers: { "Content-Type": "application/json" } })
    }

    // 3. Insertar juego (con reintentos si hay conflicto UNIQUE)
    let lastError: Error | null = null
    let currentGame = game
    const maxRetries = 5
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await insertarJuegoRandom(supabase, currentGame, formattedDate)
        const logId = await registrarLog(supabase, {
          exito: true,
          id_juego_rawg: currentGame.id,
          nombre_juego: currentGame.name,
          fecha_judi: formattedDate,
        })
        return new Response(JSON.stringify({
          success: true,
          game: currentGame.name,
          log_id: logId,
        }), { headers: { "Content-Type": "application/json" } })
      } catch (err: any) {
        lastError = err
        const isUniqueViolation = err?.message?.includes('duplicate') ||
          err?.code === '23505' || err?.message?.includes('unique')
        if (isUniqueViolation && attempt < maxRetries) {
          idsExcluidos.add(currentGame.id)
          const nextGame = await obtenerJuegoRandom(idsExcluidos)
          if (nextGame) {
            currentGame = nextGame
          } else {
            break
          }
        } else {
          break
        }
      }
    }

    const errMsg = lastError?.message || "Unknown error"
    const errStack = lastError?.stack
    const logId = await registrarLog(supabase, {
      exito: false,
      error_mensaje: errMsg,
      error_stack: errStack || undefined,
      id_juego_rawg: currentGame?.id,
      nombre_juego: currentGame?.name,
      fecha_judi: formattedDate,
    })
    return new Response(JSON.stringify({
      success: false,
      error: errMsg,
      log_id: logId,
    }), { status: 500, headers: { "Content-Type": "application/json" } })
  } catch (error: any) {
    const errMsg = error?.message || "Unknown error"
    const errStack = error?.stack
    const logId = await registrarLog(supabase, {
      exito: false,
      error_mensaje: errMsg,
      error_stack: errStack || undefined,
      fecha_judi: formattedDate,
    })
    return new Response(JSON.stringify({
      success: false,
      error: errMsg,
      log_id: logId,
    }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
})

async function obtenerJuegoRandom(idsExcluidos: Set<number>): Promise<any | null> {
  const url = 'https://api.rawg.io/api/games'
  let randomGame = null
  let attempts = 0

  while (!randomGame && attempts < 20) {
    attempts++
    const page = Math.floor(Math.random() * 150) + 1
    const response = await fetch(`${url}?key=${RAWG_API_KEY}&ordering=-rating&page_size=50&page=${page}&exclude_additions=true`)
    const data = await response.json()

    const filteredGames = (data.results || []).filter((g: any) =>
      g.reviews_count >= 300 &&
      g.short_screenshots &&
      g.short_screenshots.length >= 6 &&
      !idsExcluidos.has(g.id)
    )

    if (filteredGames.length > 0) {
      randomGame = filteredGames[Math.floor(Math.random() * filteredGames.length)]
    }
  }

  return randomGame
}

function validarJuego(game: any): boolean {
  if (!game?.id || !game?.name) return false
  const platforms = game.platforms || []
  const genres = game.genres || []
  const screenshots = game.short_screenshots || []
  if (platforms.length === 0 || genres.length === 0 || screenshots.length < 6) return false
  for (const p of platforms) {
    if (!p?.platform?.name) return false
  }
  for (const g of genres) {
    if (!g?.name) return false
  }
  return true
}

async function insertarJuegoRandom(supabase: any, game: any, formattedDate: string) {
  if (!validarJuego(game)) {
    throw new Error("Game data invalid: missing platforms, genres or screenshots")
  }

  const { error: gameError } = await supabase
    .from('hubgames_lista_videojuegos_judi')
    .insert({
      id_videojuego: game.id,
      nombre: game.name,
      fecha: formattedDate,
      calificacion: game.metacritic ?? 0,
      desarrollador: String(game.rating ?? ""),
      released: game.released ?? "",
    })
    .select()
    .single()

  if (gameError) throw gameError

  const platforms = (game.platforms || []).map((p: any) => p?.platform?.name).filter(Boolean)
  for (const platformName of platforms) {
    await supabase.from('hubgames_plataformas').upsert({ plataforma: platformName })
    await supabase.from('hubgames_videojuego_plataforma').upsert(
      { id_videojuego: game.id, plataforma: platformName }
    )
  }

  const genres = (game.genres || []).map((g: any) => g?.name).filter(Boolean)
  for (const genreName of genres) {
    await supabase.from('hubgames_generos').upsert({ genero: genreName })
    await supabase.from('hubgames_videojuego_genero').upsert(
      { id_videojuego: game.id, genero: genreName }
    )
  }

  const screenshots = (game.short_screenshots || []).slice(0, 7)
    .filter((s: any) => s?.image)
    .map((s: any) => ({ captura: s.image, id_videojuego: game.id }))
  if (screenshots.length > 0) {
    await supabase.from('hubgames_capturas').upsert(screenshots)
  }
}

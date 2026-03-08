import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RAWG_API_KEY = Deno.env.get('RAWG_API_KEY') ?? ""
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ""

function log(step: string, detail: string, extra?: Record<string, unknown>) {
  const msg = `[JUDI] ${step} | ${detail}` + (extra ? ` | ${JSON.stringify(extra)}` : '')
  console.log(msg)
}

function logError(step: string, detail: string, err?: unknown) {
  const errStr = err instanceof Error ? `${err.message} | stack: ${err.stack}` : String(err)
  console.error(`[JUDI] ERROR @ ${step} | ${detail} | ${errStr}`)
}

type LogEntry = {
  exito: boolean
  error_mensaje?: string
  error_stack?: string
  id_juego_rawg?: number
  nombre_juego?: string
  fecha_judi?: string
}

const MAX_STACK_LENGTH = 2000

async function registrarLog(supabase: any, entry: LogEntry): Promise<number | null> {
  const safeEntry = { ...entry }
  if (safeEntry.error_stack && safeEntry.error_stack.length > MAX_STACK_LENGTH) {
    safeEntry.error_stack = safeEntry.error_stack.slice(0, MAX_STACK_LENGTH) + '...[truncated]'
  }
  log('registrarLog', 'insertando en hubgames_judi_generacion_logs', { exito: safeEntry.exito, error: safeEntry.error_mensaje?.slice(0, 100) })
  const { data, error } = await supabase
    .from('hubgames_judi_generacion_logs')
    .insert(safeEntry)
    .select('id')
    .single()
  if (error) {
    logError('registrarLog', 'fallo insert BD', { pgError: error.message, code: error.code, details: error.details })
    return null
  }
  log('registrarLog', 'log registrado OK', { log_id: data?.id })
  return data?.id ?? null
}

serve(async (req) => {
  const formattedDate = (() => {
    const t = new Date().toISOString().split('T')[0]
    const [y, m, d] = t.split('-')
    return `${d}-${m}-${y}`
  })()

  log('INIT', 'invocación recibida', {
    formattedDate,
    hasRawgKey: !!RAWG_API_KEY,
    hasSupabaseUrl: !!SUPABASE_URL,
    hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY,
  })

  if (!RAWG_API_KEY) {
    logError('INIT', 'RAWG_API_KEY no configurada', null)
    const logId = null // no podemos registrar sin Supabase
    return new Response(JSON.stringify({ success: false, error: 'RAWG_API_KEY not configured', log_id: logId }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logError('INIT', 'Supabase env incompleta', { hasUrl: !!SUPABASE_URL, hasKey: !!SUPABASE_SERVICE_ROLE_KEY })
    return new Response(JSON.stringify({ success: false, error: 'Supabase config incomplete' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // 1. Verificar si ya existe el juego de hoy
    log('STEP_1', 'verificando juego existente para fecha', { fecha: formattedDate })
    const { data: existente, error: errExist } = await supabase
      .from('hubgames_lista_videojuegos_judi')
      .select('id, id_videojuego, nombre')
      .eq('fecha', formattedDate)
      .maybeSingle()

    if (errExist) {
      logError('STEP_1', 'error consultando juego existente', errExist)
      const logId = await registrarLog(supabase, {
        exito: false,
        error_mensaje: `Select existente: ${errExist.message}`,
        error_stack: errExist.details,
        fecha_judi: formattedDate,
      })
      return new Response(JSON.stringify({ success: false, error: errExist.message, log_id: logId }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (existente) {
      log('STEP_1', 'juego ya existe, saltando', { id: existente.id, nombre: existente.nombre })
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
    log('STEP_2', 'obteniendo lista de ids ya usados')
    const { data: juegosExistentes, error: errJuegos } = await supabase
      .from('hubgames_lista_videojuegos_judi')
      .select('id_videojuego')
    if (errJuegos) {
      logError('STEP_2', 'error obteniendo juegos existentes', errJuegos)
      const logId = await registrarLog(supabase, {
        exito: false,
        error_mensaje: `Select juegos: ${errJuegos.message}`,
        error_stack: errJuegos.details,
        fecha_judi: formattedDate,
      })
      return new Response(JSON.stringify({ success: false, error: errJuegos.message, log_id: logId }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const idsExcluidos = new Set((juegosExistentes || []).map((r: any) => r.id_videojuego))
    log('STEP_2', 'ids excluidos cargados', { count: idsExcluidos.size })

    log('STEP_3', 'llamando obtenerJuegoRandom')
    const game = await obtenerJuegoRandom(idsExcluidos)
    if (!game) {
      logError('STEP_3', 'No se encontró juego válido tras 20 intentos RAWG', null)
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

    log('STEP_3', 'juego obtenido de RAWG', { id: game.id, nombre: game.name })

    // 4. Insertar juego (con reintentos si hay conflicto UNIQUE)
    let lastError: Error | null = null
    let currentGame = game
    const maxRetries = 5
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      log('STEP_4', `intento ${attempt}/${maxRetries} insertar juego`, { id: currentGame.id, nombre: currentGame.name })
      try {
        await insertarJuegoRandom(supabase, currentGame, formattedDate)
        const logId = await registrarLog(supabase, {
          exito: true,
          id_juego_rawg: currentGame.id,
          nombre_juego: currentGame.name,
          fecha_judi: formattedDate,
        })
        log('STEP_4', 'juego insertado OK', { nombre: currentGame.name })
        return new Response(JSON.stringify({
          success: true,
          game: currentGame.name,
          log_id: logId,
        }), { headers: { "Content-Type": "application/json" } })
      } catch (err: any) {
        lastError = err
        logError('STEP_4', `intento ${attempt} falló`, err)
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
    logError('STEP_4', 'todos los reintentos fallaron', lastError)
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
    logError('CATCH', 'error inesperado en handler principal', error)
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
    const reqUrl = `${url}?key=${RAWG_API_KEY}&ordering=-rating&page_size=50&page=${page}&exclude_additions=true`
    log('RAWG', `intento ${attempts}/20`, { page })

    let response: Response
    try {
      response = await fetch(reqUrl)
    } catch (fetchErr: any) {
      logError('RAWG', `fetch falló intento ${attempts}`, fetchErr)
      continue
    }

    if (!response.ok) {
      const body = await response.text()
      logError('RAWG', `HTTP ${response.status}`, { statusText: response.statusText, body: body.slice(0, 200) })
      continue
    }

    let data: any
    try {
      data = await response.json()
    } catch (parseErr: any) {
      logError('RAWG', `JSON parse falló intento ${attempts}`, parseErr)
      continue
    }

    if (data.detail) {
      logError('RAWG', 'API devolvió detail (error)', data.detail)
      continue
    }

    const results = data.results || []
    const filteredGames = results.filter((g: any) =>
      g.reviews_count >= 300 &&
      g.short_screenshots &&
      g.short_screenshots.length >= 6 &&
      !idsExcluidos.has(g.id)
    )

    if (filteredGames.length > 0) {
      randomGame = filteredGames[Math.floor(Math.random() * filteredGames.length)]
      log('RAWG', 'juego encontrado', { id: randomGame.id, nombre: randomGame.name, totalResults: results.length, filteredCount: filteredGames.length })
    } else {
      log('RAWG', 'ningún juego pasó filtros en esta página', { page, totalResults: results.length })
    }
  }

  if (!randomGame) {
    log('RAWG', 'salida sin juego tras 20 intentos')
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
    logError('INSERT', 'validación juego fallida', { id: game?.id, name: game?.name })
    throw new Error("Game data invalid: missing platforms, genres or screenshots")
  }

  log('INSERT', 'insertando en hubgames_lista_videojuegos_judi', { id_videojuego: game.id, nombre: game.name })
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

  if (gameError) {
    logError('INSERT', 'fallo insert lista_videojuegos_judi', { pgMessage: gameError.message, pgCode: gameError.code, pgDetails: gameError.details })
    throw new Error(gameError.message || `Insert lista: ${JSON.stringify(gameError)}`)
  }
  log('INSERT', 'lista_videojuegos_judi OK, insertando plataformas')

  const platforms = (game.platforms || []).map((p: any) => p?.platform?.name).filter(Boolean)
  for (const platformName of platforms) {
    const { error: e1 } = await supabase.from('hubgames_plataformas').upsert({ plataforma: platformName })
    if (e1) throw new Error(`Plataforma ${platformName}: ${e1.message}`)
    const { error: e2 } = await supabase.from('hubgames_videojuego_plataforma').upsert(
      { id_videojuego: game.id, plataforma: platformName }
    )
    if (e2) {
      logError('INSERT', 'fallo upsert videojuego_plataforma', { plataforma: platformName, error: e2.message })
      throw new Error(`Videojuego plataforma: ${e2.message}`)
    }
  }
  log('INSERT', 'plataformas OK, insertando géneros')

  const genres = (game.genres || []).map((g: any) => g?.name).filter(Boolean)
  for (const genreName of genres) {
    const { error: e1 } = await supabase.from('hubgames_generos').upsert({ genero: genreName })
    if (e1) throw new Error(`Género ${genreName}: ${e1.message}`)
    const { error: e2 } = await supabase.from('hubgames_videojuego_genero').upsert(
      { id_videojuego: game.id, genero: genreName }
    )
    if (e2) {
      logError('INSERT', 'fallo upsert videojuego_genero', { genero: genreName, error: e2.message })
      throw new Error(`Videojuego género: ${e2.message}`)
    }
  }
  log('INSERT', 'géneros OK, insertando capturas')

  const screenshots = (game.short_screenshots || []).slice(0, 7)
    .filter((s: any) => s?.image)
    .map((s: any) => ({ captura: s.image, id_videojuego: game.id }))
  if (screenshots.length > 0) {
    const { error: capErr } = await supabase.from('hubgames_capturas').upsert(screenshots)
    if (capErr) {
      logError('INSERT', 'fallo upsert capturas', { error: capErr.message, count: screenshots.length })
      throw new Error(`Capturas: ${capErr.message}`)
    }
  }
  log('INSERT', 'todo OK')
}

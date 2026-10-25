import type { Json } from '@/lib/supabase/database.types'

/** Pistas desbloqueadas de un JUDI (#39). Solo vienen las de las fases ya abiertas. */
export type JudiHints = {
    generos?: string | null
    ccu?: number | null
    positivas?: number | null
    anio?: string | null
    estudio?: string | null
}

export type JudiDayState = 'playing' | 'won' | 'lost'

/** Respuesta de hubgames_judi_get_day / hubgames_judi_guess / hubgames_judi_guess_anon. */
export type JudiDay = {
    id: number
    fecha: string
    /** Fase más alta desbloqueada (1-6). */
    phase: number
    captureCount: number
    hints: JudiHints
    /** Solo al terminar. */
    nombre: string | null
    headerImage: string | null
    appid: number | null
    state: JudiDayState
    /** Con sesión: intentos fallados (fase1..fase6). Sin sesión: null. */
    failed: number | null
    /** Con sesión: nombres fallados guardados. Sin sesión: null. */
    guesses: string[] | null
    /** Solo en los intentos. */
    result: 'correct' | 'wrong' | 'skipped' | 'duplicate' | 'finished' | null
}

function num(v: unknown): number | null {
    return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function str(v: unknown): string | null {
    return typeof v === 'string' && v.trim() ? v : null
}

export function parseJudiDay(raw: Json | null | undefined): JudiDay | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const r = raw as Record<string, unknown>
    const id = num(r.id)
    if (id === null) return null
    const h = (r.hints && typeof r.hints === 'object' ? r.hints : {}) as Record<string, unknown>
    const hints: JudiHints = {}
    if ('generos' in h) hints.generos = str(h.generos)
    if ('ccu' in h) hints.ccu = num(h.ccu)
    if ('positivas' in h) hints.positivas = num(h.positivas)
    if ('anio' in h) hints.anio = str(h.anio)
    if ('estudio' in h) hints.estudio = str(h.estudio)
    const state = r.state === 'won' || r.state === 'lost' ? r.state : 'playing'
    const result = typeof r.result === 'string' ? (r.result as JudiDay['result']) : null
    return {
        id,
        fecha: String(r.fecha ?? ''),
        phase: Math.min(6, Math.max(1, num(r.phase) ?? 1)),
        captureCount: num(r.capture_count) ?? 0,
        hints,
        nombre: str(r.nombre),
        headerImage: str(r.header_image),
        appid: num(r.appid),
        state,
        failed: num(r.failed),
        guesses: Array.isArray(r.guesses) ? r.guesses.filter((g): g is string => typeof g === 'string') : null,
        result,
    }
}

/** URL del proxy de capturas: el navegador nunca ve la URL de Steam, que lleva el appid. */
export function judiCaptureUrl(id: number, phase: number) {
    return `/api/judi/captura/${id}/${phase}`
}

/**
 * Clave de localStorage de un día para invitados. Antes era `fecha::appid`; el appid ya no llega al navegador, así que
 * ahora es la fecha (hay un JUDI por día). Devuelve la clave existente, nueva o antigua.
 */
export function findJudiLocalKey(raw: Record<string, unknown>, fecha: string): string | undefined {
    if (fecha in raw) return fecha
    return Object.keys(raw).find((k) => k.startsWith(`${fecha}::`))
}

/** Escribe `value` en la clave nueva (la fecha) y borra las antiguas de ese día. */
export function writeJudiLocal<T>(raw: Record<string, T>, fecha: string, id: number, value: T): Record<string, T> {
    const next: Record<string, T> = {}
    for (const [k, v] of Object.entries(raw)) {
        if (k === fecha || k.startsWith(`${fecha}::`) || k === String(id)) continue
        next[k] = v
    }
    next[fecha] = value
    return next
}

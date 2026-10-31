import type { Json } from '@/lib/supabase/database.types'

/** Se lanza en `window` tras cada intento en JUDI, para que la navegación refresque el estado de hoy. */
export const JUDI_CHANGED_EVENT = 'hg-judi-changed'

/** Pistas desbloqueadas de un JUDI (#39). Solo vienen las de las fases ya abiertas. */
export type JudiHints = {
    generos?: string | null
    /** Rango de propietarios de SteamSpy tal cual («10,000,000 .. 20,000,000»); se formatea con `judiOwnersLabel`. */
    propietarios?: string | null
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
    /** Con sesión y la migración de saltos: todos los intentos en orden (texto = fallo, null = salto). Si no, null. */
    attempts: (string | null)[] | null
    /** Solo en los intentos. */
    result: 'correct' | 'wrong' | 'skipped' | 'duplicate' | 'finished' | null
}

function num(v: unknown): number | null {
    return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function str(v: unknown): string | null {
    return typeof v === 'string' && v.trim() ? v : null
}

function ownersNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toLocaleString('es-ES')
    return n.toLocaleString('es-ES')
}

/**
 * Rango de propietarios de SteamSpy («10,000,000 .. 20,000,000») en español: «10–20 millones», «500.000–1 millón»,
 * «20.000–50.000» o «menos de 20.000». Si no se entiende, el texto tal cual.
 */
export function judiOwnersLabel(raw: string): string {
    const m = /^\s*([\d,.]+)\s*\.\.\s*([\d,.]+)\s*$/.exec(raw)
    if (!m) return raw.trim()
    const lo = Number(m[1].replace(/[,.]/g, ''))
    const hi = Number(m[2].replace(/[,.]/g, ''))
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= 0) return raw.trim()
    const unit = hi >= 1_000_000 ? (hi === 1_000_000 ? ' millón' : ' millones') : ''
    if (lo === 0) return `menos de ${ownersNumber(hi)}${unit}`
    // Los dos extremos en millones: «10–20 millones»; si no, cada uno con su forma («500.000–1 millón»).
    const from = hi >= 1_000_000 && lo < 1_000_000 ? lo.toLocaleString('es-ES') : ownersNumber(lo)
    return `${from}–${ownersNumber(hi)}${unit}`
}

export function parseJudiDay(raw: Json | null | undefined): JudiDay | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const r = raw as Record<string, unknown>
    const id = num(r.id)
    if (id === null) return null
    const h = (r.hints && typeof r.hints === 'object' ? r.hints : {}) as Record<string, unknown>
    const hints: JudiHints = {}
    if ('generos' in h) hints.generos = str(h.generos)
    if ('propietarios' in h) hints.propietarios = str(h.propietarios)
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
        attempts: Array.isArray(r.attempts)
            ? r.attempts.map((a) => (typeof a === 'string' && a.trim() ? a : null))
            : null,
        result,
    }
}

/**
 * URL del proxy de capturas: el navegador nunca ve la URL de Steam, que lleva el appid. `small` pide la variante de
 * 600×338 (~100 KB frente a ~650 KB de la original), para miniaturas y portadas.
 */
export function judiCaptureUrl(id: number, phase: number, size: 'full' | 'small' = 'full') {
    return `/api/judi/captura/${id}/${phase}${size === 'small' ? '?s=sm' : ''}`
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

/**
 * Resultado para compartir (#38), al estilo Wordle: 🟥 por fallo, 🟩 el acierto y ⬛ los intentos que sobraron.
 * Sin el nombre del juego, para no destripárselo a quien no lo ha jugado.
 */
export function judiShareText(game: { id: number; fecha: string }, state: 'won' | 'lost', failed: number, url: string): string {
    const misses = state === 'lost' ? 6 : Math.min(Math.max(0, failed), 5)
    const squares = state === 'lost' ? '🟥'.repeat(6) : '🟥'.repeat(misses) + '🟩' + '⬛'.repeat(5 - misses)
    const score = state === 'lost' ? 'X/6' : `${misses + 1}/6`
    return `JUDI #${game.id} (${game.fecha.replaceAll('-', '/')}) ${score}\n${squares}\n${url}`
}

// ── Intentos (rediseño de JUDI) ──

/** Intentos que tiene una partida: 6, uno por captura. La fase n es el intento n (cada fallo o salto abre la siguiente). */
export const JUDI_ATTEMPTS = 6

/** Un intento que no acertó: fallo con nombre o salto. `name` null en un fallo = no sabemos cuál fue (partidas antiguas). */
export type JudiAttempt = { kind: 'miss' | 'skip'; name: string | null }

/** Cómo se ve cada uno de los 6 intentos: hecho (fallo, salto, acierto), el que juegas, sin usar tras acertar o bloqueado. */
export type JudiSlotKind = 'miss' | 'skip' | 'hit' | 'current' | 'open' | 'locked'
export type JudiSlot = { kind: JudiSlotKind; name: string | null }

/**
 * Los intentos de una partida en su orden. Con la migración `hubgames_judi_intentos_saltos`, el servidor manda
 * `attempts` (texto = fallo, null = salto) y cuadra con `failed`: es exacto. Si no cuadra (servidor sin la migración,
 * partidas anteriores sin sus saltos o que borraron los fallos al acertar), cada intento es un fallo sin orden conocido
 * (`exact: false`) y los nombres que sí tenemos van aparte.
 */
export function attemptHistory(input: {
    attempts?: readonly (string | null)[] | null
    guesses?: readonly string[] | null
    failed: number
}): { attempts: JudiAttempt[]; names: string[]; exact: boolean } {
    const failed = Math.min(Math.max(0, input.failed), JUDI_ATTEMPTS)
    const raw = input.attempts ?? null
    if (raw && raw.length === failed) {
        const attempts = raw.map((a): JudiAttempt => (a ? { kind: 'miss', name: a } : { kind: 'skip', name: null }))
        return { attempts, names: attempts.flatMap((a) => (a.name ? [a.name] : [])), exact: true }
    }
    const names = (raw ? raw.filter((a): a is string => !!a) : (input.guesses ?? [])).slice(0, failed)
    return { attempts: Array.from({ length: failed }, () => ({ kind: 'miss', name: null })), names, exact: false }
}

/** Los 6 intentos para pintarlos (tira de capturas, cuadraditos, compartir). */
export function attemptSlots(state: JudiDayState, attempts: readonly JudiAttempt[]): JudiSlot[] {
    const failed = Math.min(attempts.length, JUDI_ATTEMPTS)
    return Array.from({ length: JUDI_ATTEMPTS }, (_, i): JudiSlot => {
        if (i < failed) return { kind: attempts[i].kind, name: attempts[i].name }
        if (state === 'won' && i === failed) return { kind: 'hit', name: null }
        if (state === 'playing' && i === failed) return { kind: 'current', name: null }
        if (state === 'won') return { kind: 'open', name: null }
        return { kind: 'locked', name: null }
    })
}

/** Puntos si aciertas ahora: 6 menos los intentos gastados, mínimo 1 (la cuenta de `getPointsForRecord`). */
export function pointsAtStake(failed: number): number {
    return Math.max(JUDI_ATTEMPTS - Math.max(0, failed), 1)
}

function count(n: number, one: string, many: string) {
    return `${n} ${n === 1 ? one : many}`
}

/** Titular y segunda línea del resultado. */
export function resultSummary(state: 'won' | 'lost', attempts: readonly JudiAttempt[], exact: boolean): { title: string; detail: string } {
    const failed = attempts.length
    const misses = attempts.filter((a) => a.kind === 'miss').length
    const skips = failed - misses
    const parts = exact
        ? [misses && count(misses, 'fallo', 'fallos'), skips && count(skips, 'saltado', 'saltados')].filter(Boolean).join(' y ')
        : count(failed, 'intento fallado', 'intentos fallados')
    if (state === 'won') {
        if (failed === 0) return { title: '¡Acertado a la primera!', detail: 'Con solo la primera captura' }
        return { title: `¡Acertado en la fase ${failed + 1}!`, detail: `Tras ${parts}` }
    }
    return { title: 'Esta vez no', detail: `${parts.charAt(0).toUpperCase()}${parts.slice(1)}, sin dar con él` }
}

/**
 * Siguiente opción del desplegable con ↑/↓ (`dir` 1 o -1), saltando las ya probadas y dando la vuelta. -1 si no hay
 * ninguna que se pueda elegir. Con `from` -1 y `dir` 1 da la primera libre.
 */
export function nextOption(tried: readonly boolean[], from: number, dir: 1 | -1): number {
    const n = tried.length
    if (n === 0) return -1
    let i = from
    for (let k = 0; k < n; k++) {
        i = (((i + dir) % n) + n) % n
        if (!tried[i]) return i
    }
    return -1
}

// ── Tus estadísticas e historial (portada de /judi) ──

/** Cómo quedó un día: acertado, fallado, empezado sin terminar o sin jugar. */
export type JudiDayStatus = 'won' | 'lost' | 'progress' | 'new'

/** Filtros del historial: todos o un estado (Pendientes se parte en «En curso» y «Sin jugar»). */
export type JudiFilter = 'all' | JudiDayStatus
export const JUDI_FILTERS: readonly JudiFilter[] = ['all', 'won', 'lost', 'progress', 'new']
export const JUDI_FILTER_LABELS: Record<JudiFilter, string> = {
    all: 'Todos',
    won: 'Acertados',
    lost: 'Fallados',
    progress: 'En curso',
    new: 'Sin jugar',
}

/** Lo mínimo de un día para las cifras: su fecha (AAAA-MM-DD), cómo quedó y cuántos intentos gastaste (fase1..fase6). */
export type JudiStatDay = { date: string; status: JudiDayStatus; failed: number }

export function judiDayStatus(p: { completado?: boolean | null; fase6?: boolean | null }, failed: number): JudiDayStatus {
    if (p.completado) return 'won'
    if (p.fase6) return 'lost'
    return failed > 0 ? 'progress' : 'new'
}

/** `fecha` de la lista (DD-MM-AAAA) a AAAA-MM-DD; null si no se entiende. */
export function judiIsoDate(fecha: string): string | null {
    const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(fecha.trim())
    if (!m) return null
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

/** Puntos de un día: 6 menos los intentos gastados (mínimo 1) si lo acertaste; 0 si no (como `getPointsForRecord`). */
export function judiDayPoints(day: Pick<JudiStatDay, 'status' | 'failed'>): number {
    return day.status === 'won' ? pointsAtStake(day.failed) : 0
}

export type JudiStats = {
    wins: number
    losses: number
    progress: number
    unplayed: number
    /** Terminados (acertados + fallados). */
    played: number
    points: number
    /** % de acierto sobre los terminados, redondeado. */
    accuracy: number
    /** Intento medio en el que aciertas (1–6); null sin aciertos. */
    avgAttempt: number | null
    /** Aciertos en el intento 1..6. */
    dist: number[]
    streak: number
    /** Días de la racha actual, del más reciente al más antiguo. */
    streakDates: string[]
    streakFrom: string | null
    best: number
    bestDates: string[]
    bestFrom: string | null
    bestTo: string | null
    /** La mejor racha es la actual. */
    bestIsCurrent: boolean
    /** Hay racha y el de hoy está sin terminar: si no lo aciertas, se pierde. */
    atRisk: boolean
}

/**
 * Cifras de tu JUDI. La racha cuenta días de JUDI seguidos acertados (por la fecha del JUDI, juegues cuando juegues):
 * un día pasado en curso o sin jugar la corta; el de hoy sin terminar no (pero la pone en riesgo). Los días que no
 * hubo JUDI no están en la lista y no cortan nada.
 */
export function judiStats(days: readonly JudiStatDay[], today: string): JudiStats {
    const asc = [...days].sort((a, b) => a.date.localeCompare(b.date))
    let wins = 0
    let losses = 0
    let progress = 0
    let unplayed = 0
    let points = 0
    let attemptsSum = 0
    const dist = [0, 0, 0, 0, 0, 0]
    for (const d of asc) {
        if (d.status === 'won') {
            wins++
            points += judiDayPoints(d)
            const i = Math.min(Math.max(0, d.failed), JUDI_ATTEMPTS - 1)
            attemptsSum += i + 1
            dist[i]++
        } else if (d.status === 'lost') losses++
        else if (d.status === 'progress') progress++
        else unplayed++
    }

    const last = asc[asc.length - 1]
    const todayOpen = Boolean(last && last.date === today && (last.status === 'new' || last.status === 'progress'))
    const streakDates: string[] = []
    for (let i = asc.length - 1; i >= 0; i--) {
        const d = asc[i]
        if (d.date === today && todayOpen) continue
        if (d.status !== 'won') break
        streakDates.push(d.date)
    }

    let run: string[] = []
    let bestDates: string[] = []
    for (const d of asc) {
        run = d.status === 'won' ? [...run, d.date] : []
        if (run.length > bestDates.length) bestDates = run
    }
    const streak = streakDates.length
    const best = bestDates.length
    const played = wins + losses
    return {
        wins,
        losses,
        progress,
        unplayed,
        played,
        points,
        accuracy: played ? Math.round((wins / played) * 100) : 0,
        avgAttempt: wins ? attemptsSum / wins : null,
        dist,
        streak,
        streakDates,
        streakFrom: streak ? streakDates[streak - 1] : null,
        best,
        bestDates,
        bestFrom: best ? bestDates[0] : null,
        bestTo: best ? bestDates[best - 1] : null,
        bestIsCurrent: streak > 0 && streak === best && bestDates[best - 1] === streakDates[0],
        atRisk: streak > 0 && todayOpen,
    }
}

export function matchesJudiFilter(day: Pick<JudiStatDay, 'status'>, filter: JudiFilter): boolean {
    return filter === 'all' || day.status === filter
}

export function judiFilterCounts(days: readonly Pick<JudiStatDay, 'status'>[]): Record<JudiFilter, number> {
    const counts: Record<JudiFilter, number> = { all: days.length, won: 0, lost: 0, progress: 0, new: 0 }
    for (const d of days) counts[d.status]++
    return counts
}

export type JudiMonth<T extends JudiStatDay> = {
    /** AAAA-MM */
    key: string
    /** Todos los días del mes (para su barra), del más reciente al más antiguo. */
    all: T[]
    /** Los que pasan el filtro. */
    shown: T[]
    won: number
    lost: number
    progress: number
}

/** Meses del historial, del más reciente al más antiguo; solo los que tienen algún día con el filtro. */
export function judiMonths<T extends JudiStatDay>(days: readonly T[], filter: JudiFilter): JudiMonth<T>[] {
    const desc = [...days].sort((a, b) => b.date.localeCompare(a.date))
    const byKey = new Map<string, JudiMonth<T>>()
    for (const d of desc) {
        const key = d.date.slice(0, 7)
        let m = byKey.get(key)
        if (!m) {
            m = { key, all: [], shown: [], won: 0, lost: 0, progress: 0 }
            byKey.set(key, m)
        }
        m.all.push(d)
        if (d.status === 'won') m.won++
        else if (d.status === 'lost') m.lost++
        else if (d.status === 'progress') m.progress++
        if (matchesJudiFilter(d, filter)) m.shown.push(d)
    }
    return [...byKey.values()].filter((m) => m.shown.length > 0)
}

/**
 * Intentos de un día del listado. `attempts` es la lista del servidor (texto = fallo, null = salto) o de localStorage;
 * undefined = el servidor aún no la manda (sin la migración `hubgames_judi_list_intentos`). Sin orden conocido, cada
 * no acierto es un fallo sin nombre (`exact: false`), como en la partida. Sin intentos gastados siempre es exacto.
 */
export function dayAttempts(attempts: readonly (string | null)[] | null | undefined, failed: number): { attempts: JudiAttempt[]; names: string[]; exact: boolean } {
    const h = attemptHistory({ attempts: attempts ?? null, failed })
    return h.attempts.length === 0 ? { ...h, exact: true } : h
}

/**
 * Administración (/admin y la tarjeta del perfil): estados de los logs de generación y de las sincronizaciones, salud de
 * JUDI (el de mañana, la reserva del pool, la ingesta semanal) y de Steam, con las mismas reglas que
 * `scripts/health-check.ts`. Todo puro: las páginas cargan las filas y aquí se decide el color y la palabra.
 */
import { parseJudiDate } from './dashboard'

const TZ = 'Europe/Madrid'
const DAY_MS = 86_400_000

export const DAILY_PICK = 'steam_pool_daily_pick'
export const WEEKLY_POOL = 'steam_weekly_pool'

/** Tono de un estado: las mismas clases que el Inicio y el perfil (`dash-*`), el acento para «En curso» y gris. */
export type AdminTone = 'dash-ok' | 'dash-warn' | 'dash-ko' | 'st-todos' | 'neutral'

/** Estado de un log o de una sincronización. «same»: el pick ya tenía juego; «stale»: «en curso» que se ha quedado colgada. */
export type RunState = 'ok' | 'ko' | 'partial' | 'run' | 'stale' | 'same'

export const RUN_STATE_META: Record<RunState, { tone: AdminTone; label: string }> = {
    ok: { tone: 'dash-ok', label: 'Correcto' },
    ko: { tone: 'dash-ko', label: 'Fallido' },
    partial: { tone: 'dash-warn', label: 'Parcial' },
    run: { tone: 'st-todos', label: 'En curso' },
    stale: { tone: 'dash-warn', label: 'Sin terminar' },
    same: { tone: 'neutral', label: 'Sin cambios' },
}

const FUENTE_LABELS: Record<string, string> = {
    [DAILY_PICK]: 'Juego del día',
    [WEEKLY_POOL]: 'Ingesta del pool',
    steam_pool_backfill: 'Relleno inicial',
    steam_pool_edge_function: 'Edge function',
}

/** Nombre de la fuente de un log de generación (la cruda si no se conoce). */
export function fuenteLabel(fuente: string | null): string {
    if (!fuente) return '—'
    return FUENTE_LABELS[fuente] ?? fuente
}

export type PoolLogFacts = {
    inserted: number
    target: number
    eligible: number
    ineligible: number
    failed: number
    attempts: number
    queue: number
    from: string | null
    to: string | null
    strategy: string | null
}

/**
 * Cifras de una ingesta semanal a partir del texto que escribe `build-judi-pool.ts` en `nombre_juego`
 * («Pool semanal 2026-10-25 → 2026-10-31 | +40/40 filas nuevas | elegibles 5 | … | cola restante 184 | … [estrategia]»).
 * `null` si el texto no tiene esa forma (error durante la ejecución, cola vacía).
 */
export function parsePoolLog(text: string | null): PoolLogFacts | null {
    if (!text) return null
    const m = /\+(\d+)\/(\d+) filas nuevas \| elegibles (\d+) \| no elegibles (\d+) \| fallos (\d+) \| intentos (\d+) \| cola restante (\d+)/.exec(text)
    if (!m) return null
    const week = /Pool semanal (\d{4}-\d{2}-\d{2}) → (\d{4}-\d{2}-\d{2})/.exec(text)
    const strategy = /\[([a-z_]+)\]\s*$/.exec(text)
    return {
        inserted: Number(m[1]),
        target: Number(m[2]),
        eligible: Number(m[3]),
        ineligible: Number(m[4]),
        failed: Number(m[5]),
        attempts: Number(m[6]),
        queue: Number(m[7]),
        from: week?.[1] ?? null,
        to: week?.[2] ?? null,
        strategy: strategy?.[1] ?? null,
    }
}

/** Juego de un log del pick diario: «Juego del día asignado: X (Steam N)» o «Sin cambios: ya había juego para … — X». */
export function parseDailyLog(text: string | null): { game: string | null; same: boolean } {
    if (!text) return { game: null, same: false }
    const assigned = /^Juego del día asignado: (.+) \(Steam \d+\)$/.exec(text)
    if (assigned) return { game: assigned[1], same: false }
    const same = /^Sin cambios: ya había juego para \S+ — (.+)$/.exec(text)
    if (same) return { game: same[1], same: true }
    return { game: null, same: false }
}

export type GenLog = { exito: boolean; fuente: string | null; nombre_juego: string | null }

/**
 * Estado de un log de generación. Una ingesta que ha metido filas nuevas pero con algún candidato fallido es «Parcial»
 * (la tabla la guarda con `exito = false`); fallida solo si no entra ninguna o si revienta.
 */
export function genLogState(log: GenLog): RunState {
    if (log.exito) return parseDailyLog(log.nombre_juego).same ? 'same' : 'ok'
    if (log.fuente === WEEKLY_POOL) {
        const facts = parsePoolLog(log.nombre_juego)
        if (facts && facts.inserted > 0) return 'partial'
    }
    return 'ko'
}

/** Minutos «en curso» a partir de los que una sincronización se da por colgada. */
export const STALE_SYNC_MIN = 15

export type SyncLog = { status: string; started_at: string; finished_at: string | null }

export function syncState(log: Pick<SyncLog, 'status' | 'started_at'>, now: Date = new Date()): RunState {
    if (log.status === 'ok') return 'ok'
    if (log.status === 'parcial') return 'partial'
    if (log.status === 'error') return 'ko'
    if (log.status === 'en_curso') return now.getTime() - Date.parse(log.started_at) > STALE_SYNC_MIN * 60_000 ? 'stale' : 'run'
    return 'same'
}

/** «8 s», «2 min 57 s» o «—» si no ha terminado. */
export function durationLabel(start: string, end: string | null): string {
    if (!end) return '—'
    const seconds = Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 1000))
    return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}

export type SyncStats = {
    library: { ownedGames: number; newToTray: number; catalogFetched: number; catalogPending: number }
    snapshotRows: number
    wishlist: { steamItems: number; pricesUpdated: number; lowsUpdated: number; snapshots: number; itadMatched: number; pricesError: string | null } | null
    /** La sincronización era anterior a la wishlist (no hay bloque). */
    wishlistMissing: boolean
    wishlistError: string | null
    achievements: { gamesDue: number; gamesSynced: number; gamesFailed: number; apiCalls: number }
    tracker: { toPlaying: number; suggestions: number } | null
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const str = (v: unknown) => (typeof v === 'string' && v ? v : null)

/** `stats` de `hubgames_sync_logs` (JSON libre) con sus campos y ceros por defecto; `null` si no hay. */
export function syncStats(raw: unknown): SyncStats | null {
    const s = obj(raw)
    if (!s) return null
    const lib = obj(s.library) ?? {}
    const ach = obj(s.achievements) ?? {}
    const wl = obj(s.wishlist)
    const prices = obj(wl?.prices) ?? {}
    const tr = obj(s.tracker)
    return {
        library: { ownedGames: num(lib.ownedGames), newToTray: num(lib.newToTray), catalogFetched: num(lib.catalogFetched), catalogPending: num(lib.catalogPending) },
        snapshotRows: num(s.snapshotRows),
        wishlist: wl
            ? {
                  steamItems: num(wl.steamItems),
                  pricesUpdated: num(prices.pricesUpdated),
                  lowsUpdated: num(prices.lowsUpdated),
                  snapshots: num(prices.snapshots),
                  itadMatched: num(prices.itadMatched),
                  pricesError: str(wl.pricesError),
              }
            : null,
        wishlistMissing: !('wishlist' in s),
        wishlistError: str(s.wishlistError),
        achievements: { gamesDue: num(ach.gamesDue), gamesSynced: num(ach.gamesSynced), gamesFailed: num(ach.gamesFailed), apiCalls: num(ach.apiCalls) },
        tracker: tr ? { toPlaying: num(tr.toPlaying), suggestions: num(tr.suggestions) } : null,
    }
}

export type Fact = { text: string; tone?: AdminTone }

/** Resumen de una sincronización en una línea: lo que siempre importa (juegos) y lo que no es cero. */
export function syncFacts(stats: SyncStats | null): Fact[] {
    if (!stats) return []
    const n = (v: number) => v.toLocaleString('es-ES')
    const out: Fact[] = [{ text: `${n(stats.library.ownedGames)} juegos` }]
    if (stats.library.newToTray) out.push({ text: `+${n(stats.library.newToTray)} a la bandeja` })
    if (stats.achievements.gamesSynced) out.push({ text: `${n(stats.achievements.gamesSynced)} con logros` })
    if (stats.tracker?.toPlaying) out.push({ text: `${n(stats.tracker.toPlaying)} a Jugando` })
    if (stats.tracker?.suggestions) out.push({ text: `${n(stats.tracker.suggestions)} sugerencias` })
    if (stats.wishlist) out.push({ text: `${n(stats.wishlist.pricesUpdated)} precios` })
    if (stats.wishlistError) out.push({ text: `Wishlist: ${stats.wishlistError}`, tone: 'dash-warn' })
    if (stats.wishlist?.pricesError) out.push({ text: `Precios: ${stats.wishlist.pricesError}`, tone: 'dash-warn' })
    if (stats.achievements.gamesFailed)
        out.push({ text: `${n(stats.achievements.gamesFailed)} ${stats.achievements.gamesFailed === 1 ? 'juego' : 'juegos'} sin logros`, tone: 'dash-warn' })
    return out
}

/** Razones del pool en español (los códigos que escribe la ingesta). */
export const POOL_REASONS: Record<string, string> = {
    positive_score_below_65: 'Positivas < 65 %',
    reviews_below_300: 'Menos de 300 reseñas',
    screenshots_below_6: 'Menos de 6 capturas',
    metadata_incomplete: 'Faltan datos',
    already_used_in_daily_history: 'Ya salió en JUDI',
}

export const poolReasonLabel = (code: string) => POOL_REASONS[code] ?? code

export type PoolFilter = 'all' | 'unused' | 'used' | 'inel' | 'disc'
export const POOL_FILTERS: readonly PoolFilter[] = ['all', 'unused', 'used', 'inel', 'disc']
export const POOL_FILTER_LABELS: Record<PoolFilter, string> = {
    all: 'Todos',
    unused: 'Sin usar',
    used: 'Usados',
    inel: 'No elegibles',
    disc: 'Descartados',
}
/** Filas por página del pool en /admin. */
export const POOL_PAGE_SIZE = 50

export type PoolRowFlags = { is_eligible: boolean; selected_for_daily: boolean; discarded: boolean }
export type PoolStateKey = Exclude<PoolFilter, 'all'>

/** Estado de una fila del pool: descartado manda, luego usado, elegible sin usar y no elegible. */
export function poolState(row: PoolRowFlags): PoolStateKey {
    if (row.discarded) return 'disc'
    if (row.selected_for_daily) return 'used'
    return row.is_eligible ? 'unused' : 'inel'
}

export const POOL_STATE_META: Record<PoolStateKey, { tone: AdminTone; label: string }> = {
    unused: { tone: 'dash-ok', label: 'Elegible' },
    used: { tone: 'st-todos', label: 'Usado' },
    inel: { tone: 'dash-warn', label: 'No elegible' },
    disc: { tone: 'dash-ko', label: 'Descartado' },
}

export type PoolCounts = Record<PoolFilter, number>

/** «< 1» para lo que no llega al 1 % sin ser cero; si no, el entero. */
export function sharePercent(part: number, total: number): string {
    if (!total || !part) return '0'
    const p = (part / total) * 100
    return p < 1 ? '< 1' : String(Math.round(p))
}

/** Hora (0–23) en Madrid. */
export function madridHour(now: Date): number {
    return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(now))
}

/** Un día en Madrid como DD-MM-YYYY (el formato de las fechas de JUDI). */
export function madridJudiDay(d: Date): string {
    const [y, m, day] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d).split('-')
    return `${day}-${m}-${y}`
}

/** Mañana en Madrid como DD-MM-YYYY. */
export function tomorrowJudiDay(now: Date): string {
    const today = parseJudiDate(madridJudiDay(now)) ?? now.getTime()
    const t = new Date(today + DAY_MS)
    return `${String(t.getUTCDate()).padStart(2, '0')}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${t.getUTCFullYear()}`
}

/** A partir de esta hora de Madrid, sin JUDI de mañana es un fallo (el health check corre a las 19:00 UTC). */
export const PICK_DEADLINE_HOUR = 20

export type TomorrowState = 'ready' | 'pending' | 'failed' | 'missing'
export type Tomorrow = { state: TomorrowState; fecha: string; game: string | null; error: string | null }

/**
 * El JUDI de mañana: listo si ya está en la lista; falló si el pick dejó un log fallido para ese día; si no, pendiente
 * hasta las 20:00 de Madrid y falta a partir de entonces. El pick sale a las 11:00 y GitHub lo retrasa varias horas.
 */
export function tomorrowStatus(
    input: { game: string | null; pickLog: { exito: boolean; fecha_judi: string | null; error_mensaje: string | null } | null },
    now: Date = new Date(),
): Tomorrow {
    const fecha = tomorrowJudiDay(now)
    if (input.game) return { state: 'ready', fecha, game: input.game, error: null }
    const log = input.pickLog
    if (log && !log.exito && log.fecha_judi === fecha) return { state: 'failed', fecha, game: null, error: log.error_mensaje }
    return { state: madridHour(now) >= PICK_DEADLINE_HOUR ? 'missing' : 'pending', fecha, game: null, error: null }
}

export const TOMORROW_META: Record<TomorrowState, { tone: AdminTone; label: string }> = {
    ready: { tone: 'dash-ok', label: 'Listo' },
    pending: { tone: 'dash-warn', label: 'Pendiente' },
    failed: { tone: 'dash-ko', label: 'Falló' },
    missing: { tone: 'dash-ko', label: 'Falta' },
}

/** Elegibles sin usar: 30 o más en verde, 7–29 en ámbar, menos en rojo. */
export function reserveTone(unused: number): AdminTone {
    return unused >= 30 ? 'dash-ok' : unused >= 7 ? 'dash-warn' : 'dash-ko'
}

/** Ingesta semanal: roja si falló o tiene 15 días o más; ámbar desde 8; si no, verde. Sin ingestas, ámbar. */
export function ingestTone(days: number | null, state: RunState | null): AdminTone {
    if (days === null || state === null) return 'dash-warn'
    if (state === 'ko' || days >= 15) return 'dash-ko'
    return days >= 8 ? 'dash-warn' : 'dash-ok'
}

/** Días completos entre dos instantes. */
export const daysBetween = (iso: string, now: Date) => Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / DAY_MS))

/** Horas desde la última sincronización correcta a partir de las que es un fallo (como el health check). */
export const MAX_SYNC_AGE_H = 36

export type SteamHealth = {
    tone: AdminTone
    /** Última correcta o parcial que terminó. */
    lastOk: (SyncLog & { source?: string }) | null
    hoursSinceOk: number | null
    inDay: number
    problemsInDay: number
    errorsInDay: number
}

/** Steam: rojo sin una correcta en 36 h; ámbar si en 24 h hay errores, parciales o colgadas; neutro si no hay ninguna. */
export function steamHealth<T extends SyncLog & { source?: string }>(logs: T[], now: Date = new Date()): SteamHealth {
    const lastOk = [...logs]
        .filter((l) => (l.status === 'ok' || l.status === 'parcial') && l.finished_at)
        .sort((a, b) => Date.parse(b.finished_at as string) - Date.parse(a.finished_at as string))[0] ?? null
    const hoursSinceOk = lastOk ? (now.getTime() - Date.parse(lastOk.finished_at as string)) / 3_600_000 : null
    const day = logs.filter((l) => now.getTime() - Date.parse(l.started_at) < DAY_MS)
    const states = day.map((l) => syncState(l, now))
    const problemsInDay = states.filter((s) => s === 'ko' || s === 'stale' || s === 'partial').length
    const errorsInDay = states.filter((s) => s === 'ko').length
    let tone: AdminTone
    if (!logs.length) tone = 'neutral'
    else if (hoursSinceOk === null || hoursSinceOk >= MAX_SYNC_AGE_H) tone = 'dash-ko'
    else tone = problemsInDay ? 'dash-warn' : 'dash-ok'
    return { tone, lastOk, hoursSinceOk, inDay: day.length, problemsInDay, errorsInDay }
}

export type Failure = { kind: 'gen' | 'sync'; id: number; at: string; title: string; message: string }

/**
 * Fallos de verdad de los últimos `days` días, del más reciente al más antiguo: logs de generación fallidos (no los
 * parciales) y sincronizaciones con error o colgadas.
 */
export function recentFailures(
    gen: (GenLog & { id: number; fecha_ejecucion: string | null; error_mensaje: string | null })[],
    sync: (SyncLog & { id: number; error: string | null })[],
    now: Date = new Date(),
    days = 7,
): Failure[] {
    const since = now.getTime() - days * DAY_MS
    const out: Failure[] = []
    for (const l of gen) {
        if (!l.fecha_ejecucion || Date.parse(l.fecha_ejecucion) < since || genLogState(l) !== 'ko') continue
        out.push({ kind: 'gen', id: l.id, at: l.fecha_ejecucion, title: fuenteLabel(l.fuente), message: l.error_mensaje || l.nombre_juego || 'Sin mensaje' })
    }
    for (const s of sync) {
        if (Date.parse(s.started_at) < since) continue
        const st = syncState(s, now)
        if (st === 'ko') out.push({ kind: 'sync', id: s.id, at: s.started_at, title: 'Sincronización con Steam', message: s.error || 'Sin mensaje' })
        if (st === 'stale')
            out.push({ kind: 'sync', id: s.id, at: s.started_at, title: 'Sincronización sin terminar', message: 'Empezó y no ha terminado: el proceso se cortó sin cerrar el log' })
    }
    return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

/** «ahora», «hace 12 min», «hace 5 h», «hace 1 día», «hace 4 días». */
export function agoLabel(iso: string, now: Date = new Date()): string {
    const m = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000))
    if (m < 1) return 'ahora'
    if (m < 60) return `hace ${m} min`
    const h = Math.round(m / 60)
    if (h < 24) return `hace ${h} h`
    const d = Math.floor(m / 1440)
    return d === 1 ? 'hace 1 día' : `hace ${d} días`
}

/** «jue 29 oct» a partir de DD-MM-YYYY. */
export function judiDayShort(fecha: string): string {
    const t = parseJudiDate(fecha)
    if (t === null) return fecha
    return new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
        .format(t)
        .replace(/\./g, '')
        .replace(',', '')
}

/** «25 oct» a partir de YYYY-MM-DD. */
export function isoDayShort(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
    if (!m) return iso
    return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })
        .format(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
        .replace('.', '')
}

/** «dom, 25 oct 2026, 21:05:31» en Madrid. */
export function fullMadrid(iso: string | null): string {
    if (!iso) return '—'
    const t = new Date(iso)
    if (Number.isNaN(t.getTime())) return '—'
    return new Intl.DateTimeFormat('es-ES', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: TZ,
    })
        .format(t)
        .replace(/\./g, '')
}

/** Si el JUDI de una fecha (DD-MM-YYYY) es posterior a hoy en Madrid. */
export function isFutureJudi(fecha: string, now: Date = new Date()): boolean {
    const t = parseJudiDate(fecha)
    const today = parseJudiDate(madridJudiDay(now))
    return t !== null && today !== null && t > today
}

/** Escala logarítmica (0–1) para la barra de relevancia: va de menos de 1 a más de 10.000. */
export function relevanceShare(score: number, max: number): number {
    if (!(max > 0) || !(score > 0)) return 0
    return Math.min(1, Math.log10(score + 1) / Math.log10(max + 1))
}

export const WORKFLOW_URL = {
    pick: 'https://github.com/Diego-Mardomingo/HubGames/actions/workflows/judi-daily-pick.yml',
    pool: 'https://github.com/Diego-Mardomingo/HubGames/actions/workflows/judi-pool-weekly.yml',
    sync: 'https://github.com/Diego-Mardomingo/HubGames/actions/workflows/steam-sync.yml',
} as const

// Dashboard (#29): qué juegas, qué viene después y qué ha pasado últimamente. Puro, con tests en dashboard.test.ts.
import { nearCompletion } from './achievements'
import { gameDuration, inBacklog } from './library'
import type { LibraryGame } from './tracker'

/** Juegos en "Jugando", el de la última partida primero. */
export function playingNow(games: LibraryGame[]): LibraryGame[] {
    return games
        .filter((g) => g.status === 'jugando')
        .sort((a, b) => time(b.rtime_last_played) - time(a.rtime_last_played) || (a.name ?? '').localeCompare(b.name ?? ''))
}

/** Los primeros `limit` pendientes en tu orden (#21), también los añadidos con su estado (#140); sin posición, al final por nombre. */
export function nextInQueue(games: LibraryGame[], limit = 5): LibraryGame[] {
    return games
        .filter(inBacklog)
        .sort(
            (a, b) =>
                (a.backlog_position ?? Number.MAX_SAFE_INTEGER) - (b.backlog_position ?? Number.MAX_SAFE_INTEGER) ||
                (a.name ?? '').localeCompare(b.name ?? ''),
        )
        .slice(0, limit)
}

/** Cerca del 100 % (#26) sin los juegos descartados. */
export function nearHundred(games: LibraryGame[], limit = 5): LibraryGame[] {
    return nearCompletion(games.filter((g) => g.status !== 'descartado')).slice(0, limit)
}

/** Minutos que faltan para terminar la historia, o null sin duración. 0 si ya la has pasado. */
export function remainingMinutes(game: Pick<LibraryGame, 'playtime_forever' | 'hltb_main' | 'hltb_main_extra' | 'hltb_completionist' | 'steamspy_median_forever'>): number | null {
    const main = gameDuration(game).main
    return main === null ? null : Math.max(0, main - game.playtime_forever)
}

/** Enlace que abre (o instala) el juego en el cliente de Steam. */
export function steamRunUrl(appid: number): string {
    return `steam://run/${appid}`
}

export interface RecentUnlock {
    appid: number
    display_name: string | null
    icon: string | null
    global_percent: number | null
    unlocktime: string | null
}

export type Activity =
    | { kind: 'logro'; at: string; appid: number; game: string | null; achievement: RecentUnlock }
    | { kind: 'completado'; at: string; appid: number; game: string | null; rating: number | null }

/** Logros y juegos completados mezclados, del más reciente al más antiguo. */
export function recentActivity(unlocks: RecentUnlock[], games: LibraryGame[], limit = 8): Activity[] {
    const names = new Map(games.map((g) => [g.appid, g.name]))
    const items: Activity[] = [
        ...unlocks
            .filter((u): u is RecentUnlock & { unlocktime: string } => !!u.unlocktime)
            .map((u) => ({ kind: 'logro' as const, at: u.unlocktime, appid: u.appid, game: names.get(u.appid) ?? null, achievement: u })),
        ...games
            .filter((g): g is LibraryGame & { completed_at: string } => g.status === 'completado' && !!g.completed_at)
            .map((g) => ({ kind: 'completado' as const, at: g.completed_at, appid: g.appid, game: g.name, rating: g.rating })),
    ]
    return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit)
}

export interface YearSummary {
    year: number
    completed: number
    /** Juegos al 100 % cuyo último logro es de este año. */
    perfect: number
    unlocks: number
    /** Minutos jugados este año según la foto diaria (#15): solo desde que empezó a tomarse. */
    minutes: number
    averageRating: number | null
}

export function yearSummary(games: LibraryGame[], unlocksThisYear: number, minutesThisYear: number, now: Date = new Date()): YearSummary {
    const year = now.getFullYear()
    const inYear = (iso: string | null) => !!iso && new Date(iso).getFullYear() === year
    const completed = games.filter((g) => g.status === 'completado' && inYear(g.completed_at))
    const rated = completed.filter((g) => g.rating !== null)
    const perfect = games.filter(
        (g) => (g.achievements_total ?? 0) > 0 && (g.achievements_unlocked ?? 0) >= (g.achievements_total ?? 0) && inYear(g.last_unlock_at),
    )
    return {
        year,
        completed: completed.length,
        perfect: perfect.length,
        unlocks: unlocksThisYear,
        minutes: minutesThisYear,
        averageRating: rated.length ? Math.round((rated.reduce((s, g) => s + Number(g.rating), 0) / rated.length) * 10) / 10 : null,
    }
}

// ── Widget de JUDI ──

export interface JudiDay {
    /** DD-MM-YYYY, como hubgames_lista_videojuegos_judi.fecha. */
    fecha: string
    completado: boolean
    /** Sexto fallo: perdido. */
    perdido: boolean
}

export type JudiTodayState = 'sin_juego' | 'pendiente' | 'en_curso' | 'acertado' | 'fallado'

/** Progreso de un JUDI: el de hubgames_judi_list (con sesión) o el de localStorage (invitados). */
export type JudiProgressFlags = Partial<Record<'completado' | 'fase1' | 'fase2' | 'fase3' | 'fase4' | 'fase5' | 'fase6', boolean | null>>

/** Estado del JUDI de hoy a partir de su progreso; `exists` = hay JUDI publicado hoy. */
export function judiTodayState(exists: boolean, progress: JudiProgressFlags | null | undefined): JudiTodayState {
    if (!exists) return 'sin_juego'
    const p = progress ?? {}
    if (p.completado) return 'acertado'
    if (p.fase6) return 'fallado'
    return p.fase1 || p.fase2 || p.fase3 || p.fase4 || p.fase5 ? 'en_curso' : 'pendiente'
}

/**
 * ¿El error de una llamada RPC es porque la función aún no existe? (PostgREST: PGRST202, «not found in the schema
 * cache»; Postgres: 42883). Sirve para caer al método anterior mientras no se aplique una migración.
 */
export function isMissingRpc(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
    if (!error) return false
    return error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message ?? '')
}

export function parseJudiDate(fecha: string): number | null {
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(fecha)
    return m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null
}

/**
 * Racha de JUDI, igual que en /judi: JUDI publicados seguidos acertados, del más reciente hacia atrás.
 * El de hoy sin terminar no la rompe; uno sin jugar, sí. `days` son todos los JUDI hasta hoy, con tu progreso.
 */
export function judiStreak(days: JudiDay[], today: string): number {
    const sorted = [...days].sort((a, b) => (parseJudiDate(b.fecha) ?? 0) - (parseJudiDate(a.fecha) ?? 0))
    let streak = 0
    for (const day of sorted) {
        if (day.fecha === today && !day.completado && !day.perdido) continue
        if (!day.completado) break
        streak++
    }
    return streak
}

function time(iso: string | null): number {
    return iso ? Date.parse(iso) : 0
}

// ── Rediseño del Inicio ──

export type ListCountKey = 'jugando' | 'pendiente' | 'pausado' | 'rejugable' | 'completado' | 'ya_jugado' | 'otros' | 'bandeja'

/**
 * Juegos por lista para los atajos de la cabecera. `unowned` son los pendientes sin comprar (cuentan solo en
 * Pendiente, como en la biblioteca).
 */
export function listCounts(
    games: Pick<LibraryGame, 'status' | 'in_backlog'>[],
    unowned: Pick<LibraryGame, 'status' | 'in_backlog'>[] = [],
): Record<ListCountKey, number> {
    const out: Record<ListCountKey, number> = { jugando: 0, pendiente: 0, pausado: 0, rejugable: 0, completado: 0, ya_jugado: 0, otros: 0, bandeja: 0 }
    for (const g of games) {
        if (g.status in out) out[g.status as ListCountKey]++
        // Los añadidos a Pendientes con su estado (#140) cuentan en las dos listas, como en la biblioteca.
        if (g.status !== 'pendiente' && inBacklog(g)) out.pendiente++
    }
    for (const g of unowned) if (inBacklog(g)) out.pendiente++
    return out
}

/**
 * Un juego cambia de lista sin recargar el Inicio (panel de sugerencias): baja el contador de `from` y sube el de `to`
 * (`n` negativo para deshacer). Las listas que no tienen atajo se ignoran; nunca baja de 0.
 */
export function moveListCount(
    counts: Record<ListCountKey, number>,
    from: string,
    to: string,
    n: number = 1,
): Record<ListCountKey, number> {
    const out = { ...counts }
    if (from in out) out[from as ListCountKey] = Math.max(0, out[from as ListCountKey] - n)
    if (to in out) out[to as ListCountKey] = Math.max(0, out[to as ListCountKey] + n)
    return out
}

export type JudiWeekState = 'ok' | 'ko' | 'hoy' | 'sin_jugar' | 'sin_juego'

const WEEKDAY = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

/**
 * Los últimos 7 días de JUDI (el último, hoy): acertado, fallado, hoy sin terminar, sin jugar o sin JUDI publicado.
 * `today` en formato DD-MM-YYYY, como `fecha`.
 */
export function judiWeek(days: JudiDay[], today: string): { fecha: string; label: string; state: JudiWeekState }[] {
    const todayMs = parseJudiDate(today)
    if (todayMs === null) return []
    const byDate = new Map(days.map((d) => [d.fecha, d]))
    return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(todayMs - (6 - i) * 86400_000)
        const fecha = `${String(date.getUTCDate()).padStart(2, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${date.getUTCFullYear()}`
        const day = byDate.get(fecha)
        const isToday = i === 6
        const state: JudiWeekState = !day ? 'sin_juego' : day.completado ? 'ok' : day.perdido ? 'ko' : isToday ? 'hoy' : 'sin_jugar'
        return { fecha, label: isToday ? 'Hoy' : WEEKDAY[date.getUTCDay()], state }
    })
}

/** Minutos jugados en el mes `month` (clave YYYY-MM-01) según la foto diaria. */
export function minutesInMonth(playtime: { date: string; minutes: number }[], month: string): number {
    const prefix = month.slice(0, 7)
    return playtime.reduce((sum, r) => sum + (r.date.startsWith(prefix) ? r.minutes : 0), 0)
}

// ── Inicio à la Refract ──

/** Una fila de hubgames_playtime_daily: minutos de un juego en un día de Madrid (YYYY-MM-DD). */
export interface PlaytimeDay {
    date: string
    minutes: number
    appid: number | null
}

const DAY_SHORT = ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá']

export interface WeekDay {
    date: string
    /** «lu», «ma»… y «Hoy» para el último. */
    label: string
    today: boolean
    minutes: number
    unlocks: number
    /** El juego al que más jugaste ese día (su portada), o null si no jugaste. */
    appid: number | null
}

function dayMs(date: string): number {
    return Date.parse(`${date}T00:00:00Z`)
}

function isoDay(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10)
}

/**
 * Tus últimos 7 días (el último, hoy): minutos, logros y el juego que más jugaste cada día.
 * `today` y las fechas de `playtime` son días de Madrid; `unlockDays`, los días de Madrid de cada logro.
 */
export function weekStrip(playtime: PlaytimeDay[], unlockDays: string[], today: string): WeekDay[] {
    const end = dayMs(today)
    return Array.from({ length: 7 }, (_, i) => {
        const ms = end - (6 - i) * 86400_000
        const date = isoDay(ms)
        const byGame = new Map<number, number>()
        let minutes = 0
        for (const r of playtime) {
            if (r.date !== date || r.minutes <= 0) continue
            minutes += r.minutes
            if (r.appid !== null) byGame.set(r.appid, (byGame.get(r.appid) ?? 0) + r.minutes)
        }
        const top = [...byGame].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]
        return {
            date,
            label: i === 6 ? 'Hoy' : DAY_SHORT[new Date(ms).getUTCDay()],
            today: i === 6,
            minutes,
            unlocks: unlockDays.filter((d) => d === date).length,
            appid: top ? top[0] : null,
        }
    })
}

/** Tu ritmo: minutos por semana de media en los últimos `days` días (hoy incluido). */
export function weeklyPace(playtime: PlaytimeDay[], today: string, days: number = 28): number {
    const from = isoDay(dayMs(today) - (days - 1) * 86400_000)
    const total = playtime.reduce((sum, r) => sum + (r.date >= from && r.date <= today && r.minutes > 0 ? r.minutes : 0), 0)
    return Math.round((total / days) * 7)
}

/**
 * Cuándo llegas a cada pendiente a tu ritmo: semanas hasta empezarlo, sumando lo que falta de los anteriores.
 * Con un hueco libre en «Jugando», el primero se puede empezar ya (0). null si no has jugado nada últimamente.
 */
export function queueHorizon(queue: LibraryGame[], paceMinutes: number, freeSlot: boolean): (number | null)[] {
    if (paceMinutes <= 0) return queue.map(() => null)
    let ahead = 0
    return queue.map((g, i) => {
        const weeks = i === 0 && freeSlot ? 0 : Math.max(1, Math.round(ahead / paceMinutes))
        ahead += g.endless ? 0 : (remainingMinutes(g) ?? 0)
        return weeks
    })
}

/** Minutos de historia que suman tus pendientes (sin los que no tienen final ni duración). */
export function queueMinutes(queue: LibraryGame[]): number {
    return queue.reduce((sum, g) => sum + (g.endless ? 0 : (remainingMinutes(g) ?? 0)), 0)
}

/** Aparcados: pausados (y «jugando» olvidados) con más de `minDays` días sin abrirlos, el más olvidado primero. */
export function parkedGames(games: LibraryGame[], now: number, minDays: number = 60): { game: LibraryGame; days: number }[] {
    return games
        .filter((g) => (g.status === 'pausado' || g.status === 'jugando') && g.rtime_last_played)
        .map((game) => ({ game, days: Math.floor((now - Date.parse(game.rtime_last_played!)) / 86400_000) }))
        .filter((p) => p.days >= minDays)
        .sort((a, b) => b.days - a.days || (a.game.name ?? '').localeCompare(b.game.name ?? ''))
}

/** Lo que sale desde hoy (fecha YYYY-MM-DD conocida), el más cercano primero, con los días que faltan. */
export function upcomingReleases<T extends { release_date: string | null }>(rows: T[], today: string, limit: number = 4): (T & { release_date: string; days: number })[] {
    const end = dayMs(today)
    return rows
        .filter((r): r is T & { release_date: string } => !!r.release_date && /^\d{4}-\d{2}-\d{2}$/.test(r.release_date) && r.release_date >= today)
        .map((r) => ({ ...r, days: Math.round((dayMs(r.release_date) - end) / 86400_000) }))
        .sort((a, b) => a.days - b.days)
        .slice(0, limit)
}

/** «Hoy», «Mañana», «En 9 días», «En 3 semanas», «En 3 meses». */
export function untilRelease(days: number): string {
    if (days <= 0) return 'Hoy'
    if (days === 1) return 'Mañana'
    if (days < 14) return `En ${days} días`
    if (days < 60) return `En ${Math.round(days / 7)} semanas`
    return `En ${Math.round(days / 30)} meses`
}

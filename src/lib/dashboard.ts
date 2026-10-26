// Dashboard (#29): qué juegas, qué viene después y qué ha pasado últimamente. Puro, con tests en dashboard.test.ts.
import { nearCompletion } from './achievements'
import { gameDuration } from './library'
import type { LibraryGame } from './tracker'

/** Juegos en "Jugando", el de la última partida primero. */
export function playingNow(games: LibraryGame[]): LibraryGame[] {
    return games
        .filter((g) => g.status === 'jugando')
        .sort((a, b) => time(b.rtime_last_played) - time(a.rtime_last_played) || (a.name ?? '').localeCompare(b.name ?? ''))
}

/** Los primeros `limit` pendientes en tu orden (#21); los que no tienen posición, al final por nombre. */
export function nextInQueue(games: LibraryGame[], limit = 5): LibraryGame[] {
    return games
        .filter((g) => g.status === 'pendiente')
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

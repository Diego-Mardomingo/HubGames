// Estadísticas por año (#32) y resumen anual (#33). Sin acceso a la base de datos, con tests en stats.test.ts.
// Años, meses y días en hora de Madrid, como las metas mensuales.
import type { LibraryGame } from './tracker'
import { genreNames } from './library'
import { streaks, type Streak } from './achievement-history'

export interface StatsUnlock {
    appid: number
    unlocktime: string
    global_percent: number | null
    display_name: string | null
    icon: string | null
    /** Descripción del logro (resumen anual: la del más raro). Opcional para no obligar a cargarla. */
    description?: string | null
}

export interface StatsDaily {
    appid: number
    /** AAAA-MM-DD (día de juego en Madrid, como hubgames_playtime_daily). */
    date: string
    minutes: number
}

export interface StatsInput {
    games: LibraryGame[]
    unlocks: StatsUnlock[]
    daily: StatsDaily[]
    /** Primer día con foto de horas (#15), AAAA-MM-DD; null si aún no hay. */
    historyStart: string | null
}

const TZ = 'Europe/Madrid'
const DAY = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

/** Día en Madrid (AAAA-MM-DD) de una fecha ISO. */
export function madridDay(iso: string): string {
    return DAY.format(new Date(iso))
}

export function madridYear(iso: string): number {
    return Number(madridDay(iso).slice(0, 4))
}

/** Mes en Madrid, 0-11. */
export function madridMonth(iso: string): number {
    return Number(madridDay(iso).slice(5, 7)) - 1
}

/**
 * Minutos por juego y año, aproximados para los años sin historial de horas: las horas totales de cada juego se
 * reparten entre los años en que desbloqueaste sus logros, en proporción a cuántos; si no tiene logros, van al año de
 * la última partida.
 */
export function approxMinutesByYear(games: LibraryGame[], unlocks: StatsUnlock[]): Map<number, Map<number, number>> {
    const unlockYears = new Map<number, Map<number, number>>()
    for (const u of unlocks) {
        const years = unlockYears.get(u.appid) ?? new Map<number, number>()
        const y = madridYear(u.unlocktime)
        years.set(y, (years.get(y) ?? 0) + 1)
        unlockYears.set(u.appid, years)
    }
    const out = new Map<number, Map<number, number>>()
    for (const g of games) {
        if (!g.playtime_forever) continue
        const years = unlockYears.get(g.appid)
        const share = new Map<number, number>()
        if (years && years.size > 0) {
            const total = [...years.values()].reduce((s, n) => s + n, 0)
            for (const [y, n] of years) share.set(y, (g.playtime_forever * n) / total)
        } else if (g.rtime_last_played) {
            share.set(madridYear(g.rtime_last_played), g.playtime_forever)
        }
        if (share.size > 0) out.set(g.appid, share)
    }
    return out
}

export interface StatsGame {
    appid: number
    name: string | null
    header_image: string | null
}

export interface CompletedGame extends StatsGame {
    rating: number | null
    completed_at: string
}

export interface TopGame extends StatsGame {
    minutes: number
}

export interface YearStats {
    year: number
    completed: CompletedGame[]
    averageRating: number | null
    /** Juegos completados con cada nota, de 0 a 10 (redondeada). */
    ratingHistogram: number[]
    /** true si el historial de horas cubre el año entero: las horas son medidas, no aproximadas. */
    hoursMeasured: boolean
    /** Horas del año: medidas si `hoursMeasured`; si no, la aproximación. */
    minutes: number
    /** Lo medido con el historial dentro del año (aunque no lo cubra entero). */
    measuredMinutes: number
    unlocks: number
    unlocksByMonth: number[]
    perfect: StatsGame[]
    /** Juegos con actividad en el año: logros, completados, horas o última partida. */
    activeGames: number
    genres: { name: string; count: number }[]
    topGames: TopGame[]
    rarest: StatsUnlock | null
    /** Racha más larga de días seguidos con logros o con horas medidas. */
    bestStreak: Streak
}

function toGame(g: LibraryGame): StatsGame {
    return { appid: g.appid, name: g.name, header_image: g.header_image }
}

function round1(n: number): number {
    return Math.round(n * 10) / 10
}

export function yearStats(input: StatsInput, year: number, approx = approxMinutesByYear(input.games, input.unlocks)): YearStats {
    const inYear = (iso: string | null) => !!iso && madridYear(iso) === year
    const byAppid = new Map(input.games.map((g) => [g.appid, g]))

    const completed = input.games
        .filter((g): g is LibraryGame & { completed_at: string } => g.status === 'completado' && inYear(g.completed_at))
        .sort((a, b) => Date.parse(a.completed_at) - Date.parse(b.completed_at))
        .map((g) => ({ ...toGame(g), rating: g.rating === null ? null : Number(g.rating), completed_at: g.completed_at }))
    const rated = completed.filter((g) => g.rating !== null)
    const ratingHistogram = Array.from({ length: 11 }, () => 0)
    for (const g of rated) ratingHistogram[Math.min(10, Math.max(0, Math.round(g.rating!)))]++

    const unlocks = input.unlocks.filter((u) => inYear(u.unlocktime))
    const unlocksByMonth = Array.from({ length: 12 }, () => 0)
    for (const u of unlocks) unlocksByMonth[madridMonth(u.unlocktime)]++

    const daily = input.daily.filter((d) => d.date.startsWith(`${year}-`) && d.minutes > 0)
    const measuredByGame = new Map<number, number>()
    for (const d of daily) measuredByGame.set(d.appid, (measuredByGame.get(d.appid) ?? 0) + d.minutes)
    const measuredMinutes = [...measuredByGame.values()].reduce((s, n) => s + n, 0)
    const hoursMeasured = !!input.historyStart && input.historyStart <= `${year}-01-01`

    const minutesByGame = new Map<number, number>()
    if (hoursMeasured) {
        for (const [appid, m] of measuredByGame) minutesByGame.set(appid, m)
    } else {
        for (const [appid, years] of approx) {
            const m = years.get(year)
            if (m) minutesByGame.set(appid, m)
        }
    }
    const minutes = Math.round([...minutesByGame.values()].reduce((s, n) => s + n, 0))

    const active = new Set<number>([...unlocks.map((u) => u.appid), ...completed.map((g) => g.appid), ...measuredByGame.keys()])
    for (const g of input.games) if (inYear(g.rtime_last_played)) active.add(g.appid)
    const genreCount = new Map<string, number>()
    for (const appid of active) {
        const g = byAppid.get(appid)
        if (!g) continue
        for (const name of genreNames(g)) genreCount.set(name, (genreCount.get(name) ?? 0) + 1)
    }

    const perfect = input.games
        .filter((g) => (g.achievements_total ?? 0) > 0 && (g.achievements_unlocked ?? 0) >= (g.achievements_total ?? 0) && inYear(g.last_unlock_at))
        .map(toGame)

    const topGames = [...minutesByGame.entries()]
        .filter(([appid]) => byAppid.has(appid))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([appid, m]) => ({ ...toGame(byAppid.get(appid)!), minutes: Math.round(m) }))

    const rarest = unlocks
        .filter((u) => u.global_percent !== null)
        .reduce<StatsUnlock | null>((best, u) => (!best || u.global_percent! < best.global_percent! ? u : best), null)

    const activeDays = [...unlocks.map((u) => madridDay(u.unlocktime)), ...daily.map((d) => d.date)]
    const bestStreak = streaks(activeDays, new Date(Date.UTC(year + 1, 0, 3))).best

    return {
        year,
        completed,
        averageRating: rated.length ? round1(rated.reduce((s, g) => s + g.rating!, 0) / rated.length) : null,
        ratingHistogram,
        hoursMeasured,
        minutes,
        measuredMinutes,
        unlocks: unlocks.length,
        unlocksByMonth,
        perfect,
        activeGames: active.size,
        genres: [...genreCount.entries()]
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es')),
        topGames,
        rarest,
        bestStreak,
    }
}

/** Años con algún dato (logros, completados, horas o última partida), del más reciente al más antiguo; siempre el actual. */
export function availableYears(input: StatsInput, now: Date = new Date()): number[] {
    const current = madridYear(now.toISOString())
    const years = new Set<number>([current])
    for (const u of input.unlocks) years.add(madridYear(u.unlocktime))
    for (const g of input.games) {
        if (g.completed_at) years.add(madridYear(g.completed_at))
        if (g.rtime_last_played) years.add(madridYear(g.rtime_last_played))
    }
    for (const d of input.daily) years.add(Number(d.date.slice(0, 4)))
    return [...years].filter((y) => y <= current).sort((a, b) => b - a)
}

/** Diferencia con el año anterior para las comparaciones: null si no hay con qué comparar. */
export function delta(current: number | null, previous: number | null): number | null {
    if (current === null || previous === null) return null
    return round1(current - previous)
}

export const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Resumen anual estilo Wrapped (#33): lo que se enseña en la página y en la imagen para compartir. */
export interface Wrapped {
    year: number
    hoursMeasured: boolean
    minutes: number
    /** Top 5 del año por horas; el primero es el más jugado. */
    top: TopGame[]
    rarest: (StatsUnlock & { game: string | null }) | null
    streak: Streak
    completed: number
    unlocks: number
    perfect: number
    activeGames: number
    topGenre: string | null
}

export function buildWrapped(s: YearStats, games: Pick<LibraryGame, 'appid' | 'name'>[]): Wrapped {
    const names = new Map(games.map((g) => [g.appid, g.name]))
    return {
        year: s.year,
        hoursMeasured: s.hoursMeasured,
        minutes: s.minutes,
        top: s.topGames,
        rarest: s.rarest ? { ...s.rarest, game: names.get(s.rarest.appid) ?? null } : null,
        streak: s.bestStreak,
        completed: s.completed.length,
        unlocks: s.unlocks,
        perfect: s.perfect.length,
        activeGames: s.activeGames,
        topGenre: s.genres[0]?.name ?? null,
    }
}

/** ¿Hay algo que resumir? Sin horas, logros ni completados, el resumen sería una página vacía. */
export function hasWrapped(w: Wrapped): boolean {
    return w.minutes > 0 || w.unlocks > 0 || w.completed > 0
}

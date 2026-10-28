// Resumen anual (Wrapped, #33) con todo lo que pinta la página rediseñada y la imagen para compartir. Se apoya en
// `yearStats` y `buildWrapped` (stats.ts) sin cambiarlos: aquí solo se añade lo derivado. Puro, con tests en wrapped.test.ts.
import type { GameStatus } from './tracker'
import { RARITY_TIERS, rarityTier, type RarityTier } from './rarity'
import {
    approxMinutesByYear,
    buildWrapped,
    hasWrapped,
    madridDay,
    madridYear,
    yearStats,
    type CompletedGame,
    type StatsDaily,
    type StatsInput,
    type StatsUnlock,
    type TopGame,
    type Wrapped,
} from './stats'

/** Un juego del top con lo que enseña la ficha: lista, marcas, tu nota, Metacritic y los logros de ese año. */
export interface WrappedGame extends TopGame {
    status: GameStatus | null
    favorite: boolean
    endless: boolean
    rating: number | null
    metacritic: number | null
    /** Logros que le sacaste ese año. */
    unlocks: number
}

export interface WrappedView extends Omit<Wrapped, 'top'> {
    top: WrappedGame[]
    /** Minutos por mes (0-11), solo si las horas son medidas; null si son aproximadas. */
    months: number[] | null
    /** Logros del año por rareza (de común a legendaria), solo las que tienen alguno. */
    rarity: { tier: RarityTier; count: number }[]
    averageRating: number | null
    /** Completados del año, del primero al último. */
    completedGames: CompletedGame[]
    /** Año en curso: último día que cuenta (hoy, AAAA-MM-DD). null si el año ya terminó. */
    through: string | null
    /** Días del año que cuentan para las equivalencias: el año entero o hasta hoy. */
    days: number
    /** Cápsula del juego del logro más raro. */
    rarestHeader: string | null
}

/** Minutos de cada mes del año a partir del historial diario. */
export function monthlyMinutes(daily: StatsDaily[], year: number): number[] {
    const out = Array.from({ length: 12 }, () => 0)
    for (const d of daily) {
        if (!d.date.startsWith(`${year}-`) || d.minutes <= 0) continue
        out[Number(d.date.slice(5, 7)) - 1] += d.minutes
    }
    return out
}

/** Logros desbloqueados en el año por rareza, de común a legendaria; sin las rarezas a cero ni los que no tienen %. */
export function rarityCounts(unlocks: StatsUnlock[], year: number): { tier: RarityTier; count: number }[] {
    const counts = new Map<RarityTier, number>()
    for (const u of unlocks) {
        if (madridYear(u.unlocktime) !== year) continue
        const tier = rarityTier(u.global_percent)
        if (tier) counts.set(tier, (counts.get(tier) ?? 0) + 1)
    }
    return RARITY_TIERS.flatMap((tier) => (counts.get(tier) ? [{ tier, count: counts.get(tier)! }] : []))
}

/** Logros del año por juego. */
export function unlocksByGame(unlocks: StatsUnlock[], year: number): Map<number, number> {
    const out = new Map<number, number>()
    for (const u of unlocks) if (madridYear(u.unlocktime) === year) out.set(u.appid, (out.get(u.appid) ?? 0) + 1)
    return out
}

function isLeap(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * Días que cuentan del año y, si es el año en curso, hasta qué día (hoy en Madrid). Un año pasado cuenta entero.
 * `today` es AAAA-MM-DD.
 */
export function yearSpan(year: number, today: string): { days: number; through: string | null } {
    const todayYear = Number(today.slice(0, 4))
    if (year < todayYear) return { days: isLeap(year) ? 366 : 365, through: null }
    const [y, m, d] = today.split('-').map(Number)
    const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1
    return { days, through: today }
}

/** Equivalencias de las horas del año: cuánto al día («2,5 h» o «40 min») y cuántos días enteros. */
export function hoursEquivalents(minutes: number, days: number): { perDay: string; wholeDays: number } {
    const perDayMinutes = days > 0 ? minutes / days : 0
    const perDay =
        perDayMinutes >= 60 ? `${(perDayMinutes / 60).toFixed(1).replace('.', ',').replace(/,0$/, '')} h` : `${Math.max(1, Math.round(perDayMinutes))} min`
    return { perDay, wholeDays: Math.floor(minutes / 60 / 24) }
}

/** Qué parte (0-100, redondeada) de las horas del año fue de un juego. */
export function shareOfYear(gameMinutes: number, totalMinutes: number): number {
    if (totalMinutes <= 0) return 0
    return Math.min(100, Math.round((gameMinutes / totalMinutes) * 100))
}

/**
 * Años del selector de la cabecera: como mucho `max` a la vista (los más recientes) y el resto en «Más». Si el año
 * elegido no está entre los recientes, ocupa el último hueco para que siempre se vea cuál es.
 */
export function yearChoices(years: number[], selected: number, max = 5): { shown: number[]; more: number[] } {
    const recent = years.slice(0, max)
    const shown = recent.includes(selected) || !years.includes(selected) ? recent : [...years.slice(0, max - 1), selected]
    return { shown, more: years.filter((y) => !shown.includes(y)) }
}

/** Cuadrados de la racha: uno por día hasta `max`; el resto se dice con «+N». */
export function streakSquares(length: number, max = 31): { shown: number; extra: number } {
    const shown = Math.min(Math.max(0, length), max)
    return { shown, extra: Math.max(0, length - max) }
}

const DAY_LONG = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' })

/** «14 de marzo» de un día AAAA-MM-DD. */
export function dayLong(key: string): string {
    const [y, m, d] = key.split('-').map(Number)
    return DAY_LONG.format(new Date(Date.UTC(y, m - 1, d)))
}

/** Tu nota con coma y sin «,0»: 9,5 · 10. */
export function formatRating(rating: number): string {
    return Number.isInteger(rating) ? String(rating) : rating.toFixed(1).replace('.', ',')
}

/** Resumen del año listo para pintar. `now` decide el año en curso (para «hasta hoy»). */
export function buildWrappedView(input: StatsInput, year: number, now: Date = new Date(), approx = approxMinutesByYear(input.games, input.unlocks)): WrappedView {
    const stats = yearStats(input, year, approx)
    const base = buildWrapped(stats, input.games)
    const byAppid = new Map(input.games.map((g) => [g.appid, g]))
    const perGame = unlocksByGame(input.unlocks, year)
    const top: WrappedGame[] = base.top.map((t) => {
        const g = byAppid.get(t.appid)
        return {
            ...t,
            status: g?.status ?? null,
            favorite: !!g?.favorite,
            endless: !!g?.endless,
            rating: g?.rating === null || g?.rating === undefined ? null : Number(g.rating),
            metacritic: g?.metacritic_score ?? null,
            unlocks: perGame.get(t.appid) ?? 0,
        }
    })
    const span = yearSpan(year, madridDay(now.toISOString()))
    return {
        ...base,
        top,
        months: stats.hoursMeasured ? monthlyMinutes(input.daily, year) : null,
        rarity: rarityCounts(input.unlocks, year),
        averageRating: stats.averageRating,
        completedGames: stats.completed,
        through: span.through,
        days: span.days,
        rarestHeader: base.rarest ? (byAppid.get(base.rarest.appid)?.header_image ?? null) : null,
    }
}

/** Otro año con algo que resumir (el más reciente) para el vacío; null si no hay ninguno. */
export function otherYearWithData(input: StatsInput, years: number[], exclude: number): number | null {
    const approx = approxMinutesByYear(input.games, input.unlocks)
    for (const y of years) {
        if (y === exclude) continue
        if (hasWrapped(buildWrapped(yearStats(input, y, approx), input.games))) return y
    }
    return null
}

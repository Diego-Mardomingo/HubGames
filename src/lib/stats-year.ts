// Vista de /estadisticas (rediseño con color): lo que la página enseña de cada año, ya calculado en el servidor a partir
// de yearStats. Puro, con tests en stats-year.test.ts. El resumen anual (Wrapped) no usa este módulo.
import type { GameStatus } from './tracker'
import { RARITY_TIERS, rarityTier, type RarityTier } from './rarity'
import { ratingTier, type ScoreTier } from './scores'
import { delta, madridDay, madridMonth, madridYear, type StatsGame, type StatsInput, type YearStats } from './stats'

/** Logros de un mes (o del año) por rareza; `unknown` = sin % global de Steam (cuentan en el total). */
export interface RaritySplit {
    total: number
    tiers: Record<RarityTier, number>
    unknown: number
}

export interface YearSummary {
    completed: number
    /** Horas redondeadas (medidas o aproximadas, como `YearStats.minutes`). */
    hours: number
    unlocks: number
    perfect: number
    averageRating: number | null
}

export interface YearListCount {
    status: GameStatus
    count: number
}

export interface YearCompleted extends StatsGame {
    completed_at: string
    rating: number | null
    /** Horas totales del juego (`playtime_forever`), en minutos. */
    minutes: number
    favorite: boolean
}

export interface YearTopGame extends StatsGame {
    minutes: number
    status: GameStatus | null
}

export interface YearRarest {
    appid: number
    game: string | null
    display_name: string | null
    description: string | null
    icon: string | null
    global_percent: number
    unlocktime: string
}

export interface YearView {
    year: number
    summary: YearSummary
    hoursMeasured: boolean
    measuredMinutes: number
    activeGames: number
    /** Doce meses; null = aún no ha llegado (año en curso). */
    months: (RaritySplit | null)[]
    rarity: RaritySplit
    /** Lista de hoy de los juegos con actividad en el año, en el orden de las listas. */
    lists: YearListCount[]
    ratingHistogram: number[]
    ratingTiers: Record<ScoreTier, number>
    completed: YearCompleted[]
    top: YearTopGame[]
    genres: { name: string; count: number }[]
    perfect: StatsGame[]
    rarest: YearRarest | null
}

/** Orden de las listas (el de GAME_STATUSES; ./tracker no se importa como valor porque crea el cliente de Supabase). */
const LIST_ORDER: readonly GameStatus[] = ['bandeja', 'pendiente', 'jugando', 'pausado', 'rejugable', 'completado', 'abandonado', 'ya_jugado', 'descartado', 'otros']

function emptySplit(): RaritySplit {
    return { total: 0, tiers: { comun: 0, poco: 0, rara: 0, epica: 0, leg: 0 }, unknown: 0 }
}

function addTo(split: RaritySplit, percent: number | null) {
    split.total++
    const tier = rarityTier(percent)
    if (tier) split.tiers[tier]++
    else split.unknown++
}

/** Meses del año que ya han llegado (en Madrid): 12 en años pasados, 0 en futuros. */
export function monthsElapsed(year: number, now: Date): number {
    const iso = now.toISOString()
    const current = madridYear(iso)
    if (year < current) return 12
    if (year > current) return 0
    return madridMonth(iso) + 1
}

/** Logros de cada mes por rareza; los meses que no han llegado, null. */
export function unlocksByMonthRarity(input: Pick<StatsInput, 'unlocks'>, year: number, now: Date): (RaritySplit | null)[] {
    const months = Array.from({ length: 12 }, emptySplit)
    for (const u of input.unlocks) {
        const day = madridDay(u.unlocktime)
        if (Number(day.slice(0, 4)) !== year) continue
        addTo(months[Number(day.slice(5, 7)) - 1], u.global_percent)
    }
    const elapsed = monthsElapsed(year, now)
    return months.map((m, i) => (i < elapsed || m.total > 0 ? m : null))
}

/** Suma de los meses: el reparto del año por rareza. */
export function sumSplits(months: (RaritySplit | null)[]): RaritySplit {
    const out = emptySplit()
    for (const m of months) {
        if (!m) continue
        out.total += m.total
        out.unknown += m.unknown
        for (const t of RARITY_TIERS) out.tiers[t] += m.tiers[t]
    }
    return out
}

/** En qué lista está hoy cada juego con actividad en el año (no hay historial de estados). */
export function listsOfYear(games: StatsInput['games'], active: number[]): YearListCount[] {
    const ids = new Set(active)
    const count = new Map<GameStatus, number>()
    for (const g of games) if (ids.has(g.appid)) count.set(g.status, (count.get(g.status) ?? 0) + 1)
    return LIST_ORDER.filter((s) => count.get(s)).map((status) => ({ status, count: count.get(status)! }))
}

/** Cuántas notas de cada nivel («Imprescindible», «Muy bueno»…). */
export function ratingTierCounts(ratings: (number | null)[]): Record<ScoreTier, number> {
    const out: Record<ScoreTier, number> = { top: 0, good: 0, mid: 0, bad: 0 }
    for (const r of ratings) if (r !== null) out[ratingTier(r)]++
    return out
}

export function yearSummary(s: YearStats): YearSummary {
    return {
        completed: s.completed.length,
        hours: Math.round(s.minutes / 60),
        unlocks: s.unlocks,
        perfect: s.perfect.length,
        averageRating: s.averageRating,
    }
}

/** Diferencia de cada cifra con el año anterior; todo null si ese año no tiene datos (no está entre los disponibles). */
export function summaryDiff(current: YearSummary, previous: YearSummary | null): Record<keyof YearSummary, number | null> {
    return {
        completed: previous ? delta(current.completed, previous.completed) : null,
        hours: previous ? delta(current.hours, previous.hours) : null,
        unlocks: previous ? delta(current.unlocks, previous.unlocks) : null,
        perfect: previous ? delta(current.perfect, previous.perfect) : null,
        averageRating: previous ? delta(current.averageRating, previous.averageRating) : null,
    }
}

/** Todo lo que /estadisticas enseña de un año. */
export function yearView(input: StatsInput, s: YearStats, now: Date = new Date()): YearView {
    const byAppid = new Map(input.games.map((g) => [g.appid, g]))
    const months = unlocksByMonthRarity(input, s.year, now)
    const rarestTier = s.rarest ? rarityTier(s.rarest.global_percent) : null
    return {
        year: s.year,
        summary: yearSummary(s),
        hoursMeasured: s.hoursMeasured,
        measuredMinutes: s.measuredMinutes,
        activeGames: s.activeGames,
        months,
        rarity: sumSplits(months),
        lists: listsOfYear(input.games, s.active),
        ratingHistogram: s.ratingHistogram,
        ratingTiers: ratingTierCounts(s.completed.map((g) => g.rating)),
        completed: s.completed.map((g) => {
            const lib = byAppid.get(g.appid)
            return { ...g, minutes: lib?.playtime_forever ?? 0, favorite: !!lib?.favorite }
        }),
        top: s.topGames.map((g) => ({ ...g, status: byAppid.get(g.appid)?.status ?? null })),
        genres: s.genres.slice(0, 8),
        perfect: s.perfect,
        rarest:
            s.rarest && rarestTier
                ? {
                      appid: s.rarest.appid,
                      game: byAppid.get(s.rarest.appid)?.name ?? null,
                      display_name: s.rarest.display_name,
                      description: s.rarest.description ?? null,
                      icon: s.rarest.icon,
                      global_percent: s.rarest.global_percent!,
                      unlocktime: s.rarest.unlocktime,
                  }
                : null,
    }
}

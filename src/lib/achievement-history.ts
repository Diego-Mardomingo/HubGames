// Historial de logros (#28): línea temporal por día y juego, heatmap anual y rachas. Fechas en la zona horaria del
// navegador. Sin acceso a la base de datos, con tests en achievement-history.test.ts.
import { achievementPoints, type Achievement } from './achievements'
import type { HeatDay, Heatmap } from './activity-heatmap'
import { RARITY_TIERS, rarityTier, type RarityTier } from './rarity'
import type { LibraryGame } from './tracker'

type Unlock = Pick<Achievement, 'appid' | 'achieved' | 'unlocktime'>

/** Día local en formato AAAA-MM-DD. */
export function dayKey(date: Date): string {
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${date.getFullYear()}-${m}-${d}`
}

/** Fecha local (mediodía, para no cruzar días con los cambios de hora) de un AAAA-MM-DD. */
export function parseDayKey(key: string): Date {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y, m - 1, d, 12)
}

function addDays(date: Date, days: number): Date {
    const next = new Date(date)
    next.setDate(next.getDate() + days)
    return next
}

function unlocksWithDate<T extends Unlock>(list: T[]): (T & { unlocktime: string })[] {
    return list.filter((a): a is T & { unlocktime: string } => a.achieved && !!a.unlocktime)
}

/** Desbloqueos por día. */
export function countByDay(list: Unlock[]): Map<string, number> {
    const out = new Map<string, number>()
    for (const a of unlocksWithDate(list)) {
        const key = dayKey(new Date(a.unlocktime))
        out.set(key, (out.get(key) ?? 0) + 1)
    }
    return out
}

export interface TimelineDay<T> {
    day: string
    games: { appid: number; achievements: T[] }[]
}

/** Desbloqueos agrupados por día y, dentro de cada día, por juego. Lo más reciente primero. */
export function groupTimeline<T extends Unlock>(list: T[]): TimelineDay<T>[] {
    const sorted = unlocksWithDate(list).sort((a, b) => Date.parse(b.unlocktime) - Date.parse(a.unlocktime))
    const days: TimelineDay<T>[] = []
    for (const a of sorted) {
        const key = dayKey(new Date(a.unlocktime))
        let day = days[days.length - 1]
        if (!day || day.day !== key) {
            day = { day: key, games: [] }
            days.push(day)
        }
        let game = day.games.find((g) => g.appid === a.appid)
        if (!game) {
            game = { appid: a.appid, achievements: [] }
            day.games.push(game)
        }
        game.achievements.push(a)
    }
    return days
}

export interface HeatmapCell {
    day: string
    count: number
    /** false para los días de relleno de la primera y la última semana, que son de otro año. */
    inYear: boolean
}

/** Semanas (columnas, de lunes a domingo) del año, como el heatmap de GitHub. */
export function heatmapWeeks(year: number, counts: Map<string, number>): HeatmapCell[][] {
    const first = new Date(year, 0, 1, 12)
    const start = addDays(first, -((first.getDay() + 6) % 7))
    const last = new Date(year, 11, 31, 12)
    const end = addDays(last, 6 - ((last.getDay() + 6) % 7))
    const weeks: HeatmapCell[][] = []
    for (let d = start; d <= end; d = addDays(d, 1)) {
        if ((d.getDay() + 6) % 7 === 0) weeks.push([])
        const key = dayKey(d)
        weeks[weeks.length - 1].push({ day: key, count: counts.get(key) ?? 0, inYear: d.getFullYear() === year })
    }
    return weeks
}

/** Intensidad del 0 al 4: ninguno, 1, de 2 a 3, de 4 a 7 y 8 o más. */
export function heatLevel(count: number): 0 | 1 | 2 | 3 | 4 {
    if (count <= 0) return 0
    if (count === 1) return 1
    if (count <= 3) return 2
    if (count <= 7) return 3
    return 4
}

export interface Streak {
    length: number
    /** AAAA-MM-DD del primer y el último día; null si la racha es 0. */
    start: string | null
    end: string | null
}

const NO_STREAK: Streak = { length: 0, start: null, end: null }

/**
 * Rachas de días seguidos con algún desbloqueo. La actual sigue viva si el último día con logros es hoy o ayer
 * (hoy aún puedes desbloquear alguno).
 */
export function streaks(days: Iterable<string>, today: Date = new Date()): { current: Streak; best: Streak } {
    const sorted = [...new Set(days)].sort()
    let best = NO_STREAK
    let run: Streak = NO_STREAK
    for (const key of sorted) {
        const continues = run.end !== null && dayKey(addDays(parseDayKey(run.end), 1)) === key
        run = continues ? { length: run.length + 1, start: run.start, end: key } : { length: 1, start: key, end: key }
        if (run.length > best.length) best = run
    }
    const todayKey = dayKey(today)
    const yesterdayKey = dayKey(addDays(today, -1))
    const current = run.end === todayKey || run.end === yesterdayKey ? run : NO_STREAK
    return { current, best }
}

/** Años con algún desbloqueo, del más reciente al más antiguo. */
export function yearsWithUnlocks(counts: Map<string, number>): number[] {
    return [...new Set([...counts.keys()].map((k) => Number(k.slice(0, 4))))].sort((a, b) => b - a)
}

// ── Rediseño del historial: resumen por mes y por día, el año elegido, rachas en el mapa, 100 % e hitos por día ──

/** Días seguidos del mismo mes, juntos ("2026-10"), en el orden en que llegan (lo más reciente primero). */
export function byMonth<D extends { day: string }>(days: D[]): { month: string; days: D[] }[] {
    const out: { month: string; days: D[] }[] = []
    for (const d of days) {
        const month = d.day.slice(0, 7)
        const last = out[out.length - 1]
        if (last && last.month === month) last.days.push(d)
        else out.push({ month, days: [d] })
    }
    return out
}

type Rated = Pick<Achievement, 'appid' | 'global_percent'>

/** Cuántos logros de cada rareza (los que no tienen % global no cuentan). */
export function tallyRarity(list: Pick<Achievement, 'global_percent'>[]): Record<RarityTier, number> {
    const out = Object.fromEntries(RARITY_TIERS.map((t) => [t, 0])) as Record<RarityTier, number>
    for (const a of list) {
        const tier = rarityTier(a.global_percent)
        if (tier) out[tier]++
    }
    return out
}

export interface PeriodSummary {
    /** Logros del periodo. */
    total: number
    points: number
    tiers: Record<RarityTier, number>
    /** La rareza más alta del periodo (null si ninguno tiene % global). */
    top: RarityTier | null
}

function summarize(list: Pick<Achievement, 'global_percent'>[]): PeriodSummary {
    const tiers = tallyRarity(list)
    const top = [...RARITY_TIERS].reverse().find((t) => tiers[t] > 0) ?? null
    return { total: list.length, points: list.reduce((n, a) => n + achievementPoints(a.global_percent), 0), tiers, top }
}

/** Un día de la línea temporal: logros, puntos, reparto por rareza y la rareza de su logro más raro (el punto del día). */
export function daySummary(day: TimelineDay<Rated>): PeriodSummary {
    return summarize(day.games.flatMap((g) => g.achievements))
}

/** Un mes: lo del día más los días con logros y sus juegos, del que más logros tiene al que menos. */
export function monthSummary(days: TimelineDay<Rated>[]): PeriodSummary & { days: number; games: number[] } {
    const list = days.flatMap((d) => d.games.flatMap((g) => g.achievements))
    const byGame = new Map<number, number>()
    for (const a of list) byGame.set(a.appid, (byGame.get(a.appid) ?? 0) + 1)
    const games = [...byGame].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([appid]) => appid)
    return { ...summarize(list), days: days.length, games }
}

const NOTABLE: { tier: RarityTier; one: string; many: string }[] = [
    { tier: 'leg', one: 'legendaria', many: 'legendarias' },
    { tier: 'epica', one: 'épica', many: 'épicas' },
    { tier: 'rara', one: 'rara', many: 'raras' },
]

/** Las rarezas que merece la pena nombrar (legendarias, épicas y raras), de la más alta a la más baja: «1 épica», «2 raras». */
export function notableRarities(tiers: Record<RarityTier, number>): { tier: RarityTier; count: number; label: string }[] {
    return NOTABLE.filter((x) => tiers[x.tier] > 0).map((x) => ({
        tier: x.tier,
        count: tiers[x.tier],
        label: `${tiers[x.tier].toLocaleString('es-ES')} ${tiers[x.tier] === 1 ? x.one : x.many}`,
    }))
}

/** El día con más logros de un año (si empatan, el más reciente). */
export function busiestDay(counts: Map<string, number>, year: number): { day: string; count: number } | null {
    let best: { day: string; count: number } | null = null
    for (const [day, count] of counts) {
        if (!day.startsWith(`${year}-`) || count <= 0) continue
        if (!best || count > best.count || (count === best.count && day > best.day)) best = { day, count }
    }
    return best
}

/** Lo del año elegido: logros, días con logros, el día más intenso y el logro más raro (con su día). */
export function yearSummary<T extends Unlock & Pick<Achievement, 'global_percent'>>(
    list: T[],
    counts: Map<string, number>,
    year: number,
): { total: number; days: number; busiest: { day: string; count: number } | null; rarest: (T & { day: string }) | null } {
    let total = 0
    let days = 0
    for (const [day, count] of counts) {
        if (!day.startsWith(`${year}-`)) continue
        total += count
        days++
    }
    let rarest: (T & { day: string }) | null = null
    for (const a of unlocksWithDate(list)) {
        if (a.global_percent === null) continue
        const day = dayKey(new Date(a.unlocktime))
        if (!day.startsWith(`${year}-`)) continue
        if (!rarest || a.global_percent < rarest.global_percent!) rarest = { ...a, day }
    }
    return { total, days, busiest: busiestDay(counts, year), rarest }
}

/** La racha actual viene de ayer: sigue viva, pero hoy aún no hay ningún logro. */
export function streakAtRisk(current: Streak, today: Date = new Date()): boolean {
    return current.length > 0 && current.end !== dayKey(today)
}

/** Posición (0, 1, 2…) de un día dentro de una racha, o -1 si no está en ella. */
export function streakIndex(day: string, streak: Pick<Streak, 'start' | 'end'>): number {
    if (!streak.start || !streak.end || day < streak.start || day > streak.end) return -1
    return Math.round((parseDayKey(day).getTime() - parseDayKey(streak.start).getTime()) / 86400_000)
}

/**
 * Día en que cada juego llegó al 100 %: el de su último desbloqueo, como en computeMilestones. Solo los juegos con
 * todos sus logros.
 */
export function perfectDays(
    unlocked: Unlock[],
    games: Pick<LibraryGame, 'appid' | 'achievements_total' | 'achievements_unlocked'>[],
): Map<number, string> {
    const last = new Map<number, string>()
    for (const a of unlocksWithDate(unlocked)) {
        const prev = last.get(a.appid)
        if (!prev || Date.parse(a.unlocktime) > Date.parse(prev)) last.set(a.appid, a.unlocktime)
    }
    const out = new Map<number, string>()
    for (const g of games) {
        const total = g.achievements_total ?? 0
        const at = last.get(g.appid)
        if (total > 0 && (g.achievements_unlocked ?? 0) >= total && at) out.set(g.appid, dayKey(new Date(at)))
    }
    return out
}

/** Hitos alcanzados (computeMilestones(...).reached) por el día en que se alcanzaron. */
export function milestonesByDay<M extends { date: string | null }>(reached: M[]): Map<string, M[]> {
    const out = new Map<string, M[]>()
    for (const m of reached) {
        if (!m.date) continue
        const day = dayKey(new Date(m.date))
        out.set(day, [...(out.get(day) ?? []), m])
    }
    return out
}

const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * El mapa de un año natural con la forma de ActivityHeatmap (semanas de lunes a domingo): los días de relleno de otros
 * años van como `out`, los que aún no han llegado como `future`, y el color sale de los logros de cada día.
 */
export function yearHeatmap(year: number, counts: Map<string, number>, today: Date = new Date()): Heatmap {
    const todayKey = dayKey(today)
    const weeks = heatmapWeeks(year, counts)
    const days: HeatDay[] = weeks.flat().map((c) => {
        const count = c.inYear ? c.count : 0
        return {
            date: c.day,
            minutes: 0,
            achievements: count,
            level: heatLevel(count),
            basis: count > 0 ? 'logros' : null,
            future: c.inYear && c.day > todayKey,
            out: !c.inYear,
        }
    })
    const candidates: { week: number; label: string }[] = []
    let previous = -1
    weeks.forEach((w, i) => {
        const first = w.find((c) => c.inYear)
        if (!first) return
        const month = Number(first.day.slice(5, 7)) - 1
        if (month !== previous) candidates.push({ week: i, label: MONTH_SHORT[month] })
        previous = month
    })
    const months = candidates.filter((m, i) => (candidates[i + 1]?.week ?? weeks.length) - m.week >= 3)
    const inYear = days.filter((d) => !d.out && !d.future)
    const last = `${year}-12-31`
    return {
        weeks: weeks.length,
        days,
        months,
        from: `${year}-01-01`,
        to: todayKey < last ? todayKey : last,
        hasToday: year === today.getFullYear(),
        totals: { minutes: 0, achievements: inYear.reduce((n, d) => n + d.achievements, 0), activeDays: inYear.filter((d) => d.achievements > 0).length },
    }
}

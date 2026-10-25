// Historial de logros (#28): línea temporal por día y juego, heatmap anual y rachas. Fechas en la zona horaria del
// navegador. Sin acceso a la base de datos, con tests en achievement-history.test.ts.
import type { Achievement } from './achievements'

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

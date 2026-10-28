// Mapa de actividad anual del dashboard (estilo GitHub): una celda por día, columnas de semanas de lunes a domingo.
// Puro, con tests en activity-heatmap.test.ts. Los datos llegan de hubgames_playtime_daily (minutos por día y juego)
// y de hubgames_user_achievements.unlocktime (logros desbloqueados).
//
// Regla de intensidad (4 niveles + vacío):
//  - Si ese día hay horas registradas, manda el tiempo jugado:
//      1: menos de 1 h · 2: de 1 a 2 h · 3: de 2 a 4 h · 4: 4 h o más.
//  - Si no hay horas pero sí logros, mandan los logros (las fotos diarias de horas solo existen desde que empezó la
//    sincronización diaria, en octubre de 2026; así el año anterior no sale vacío):
//      1: 1 logro · 2: 2–3 · 3: 4–7 · 4: 8 o más.
//  - Sin horas ni logros: 0 (vacío).
// Escalas fijas y no relativas al máximo del año: el mismo color significa siempre lo mismo.

export const HEATMAP_WEEKS = 53

export type HeatLevel = 0 | 1 | 2 | 3 | 4

export interface HeatDay {
    /** YYYY-MM-DD (día de Madrid). */
    date: string
    minutes: number
    achievements: number
    level: HeatLevel
    /** De dónde sale el color: horas, logros (sin horas ese día) o nada. */
    basis: 'horas' | 'logros' | null
    /** Días de la última semana que aún no han llegado: se dejan en blanco. */
    future: boolean
    /** Relleno de otro año en el mapa de un año natural (historial): ni se ve ni se recorre. */
    out?: boolean
}

export interface HeatMonth {
    /** Columna (semana) en la que empieza el mes. */
    week: number
    label: string
}

export interface Heatmap {
    weeks: number
    /** Por columnas: el día `d` (0 = lunes) de la semana `w` está en `days[w * 7 + d]`. */
    days: HeatDay[]
    months: HeatMonth[]
    /** Primer y último día con datos posibles (de lunes de la primera semana a hoy). */
    from: string
    to: string
    /** false si el mapa no llega a hoy (un año pasado en el historial): el último día no se marca como hoy. */
    hasToday?: boolean
    totals: { minutes: number; achievements: number; activeDays: number }
}

const DAY_MS = 86400_000
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MADRID = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Día de Madrid (YYYY-MM-DD) de un instante. */
export function madridDate(at: string | number | Date): string {
    return MADRID.format(new Date(at))
}

function toMs(date: string): number {
    return Date.parse(`${date}T00:00:00Z`)
}

function toDate(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10)
}

/** Lunes de la primera columna: `weeks - 1` semanas antes del lunes de la semana de `today`. */
export function heatmapStart(today: string, weeks: number = HEATMAP_WEEKS): string {
    const t = toMs(today)
    const weekday = (new Date(t).getUTCDay() + 6) % 7 // 0 = lunes
    return toDate(t - (weekday + (weeks - 1) * 7) * DAY_MS)
}

export function hoursLevel(minutes: number): HeatLevel {
    if (minutes <= 0) return 0
    if (minutes < 60) return 1
    if (minutes < 120) return 2
    if (minutes < 240) return 3
    return 4
}

export function achievementsLevel(count: number): HeatLevel {
    if (count <= 0) return 0
    if (count === 1) return 1
    if (count <= 3) return 2
    if (count <= 7) return 3
    return 4
}

export function dayLevel(minutes: number, achievements: number): { level: HeatLevel; basis: HeatDay['basis'] } {
    if (minutes > 0) return { level: hoursLevel(minutes), basis: 'horas' }
    if (achievements > 0) return { level: achievementsLevel(achievements), basis: 'logros' }
    return { level: 0, basis: null }
}

export interface HeatmapInput {
    /** Hoy en Madrid, YYYY-MM-DD. */
    today: string
    playtime: { date: string | null; minutes: number | null }[]
    /** Instantes (ISO) de los logros desbloqueados. */
    unlocks: (string | null)[]
    weeks?: number
}

export function buildHeatmap({ today, playtime, unlocks, weeks = HEATMAP_WEEKS }: HeatmapInput): Heatmap {
    const from = heatmapStart(today, weeks)
    const minutes = new Map<string, number>()
    for (const row of playtime) {
        if (!row.date || !row.minutes || row.minutes <= 0) continue
        minutes.set(row.date, (minutes.get(row.date) ?? 0) + row.minutes)
    }
    const achievements = new Map<string, number>()
    for (const at of unlocks) {
        if (!at) continue
        const day = madridDate(at)
        achievements.set(day, (achievements.get(day) ?? 0) + 1)
    }

    const start = toMs(from)
    const end = toMs(today)
    const days: HeatDay[] = []
    const totals = { minutes: 0, achievements: 0, activeDays: 0 }
    for (let i = 0; i < weeks * 7; i++) {
        const ms = start + i * DAY_MS
        const date = toDate(ms)
        const future = ms > end
        const m = future ? 0 : (minutes.get(date) ?? 0)
        const a = future ? 0 : (achievements.get(date) ?? 0)
        const { level, basis } = dayLevel(m, a)
        days.push({ date, minutes: m, achievements: a, level, basis, future })
        totals.minutes += m
        totals.achievements += a
        if (level > 0) totals.activeDays++
    }

    return { weeks, days, months: monthLabels(days, weeks), from, to: today, totals }
}

/**
 * Etiqueta de mes en la columna donde empieza cada mes (según el lunes de la semana). Se quitan las que no caben:
 * a menos de 3 columnas de la siguiente o del final del mapa.
 */
function monthLabels(days: HeatDay[], weeks: number): HeatMonth[] {
    const candidates: HeatMonth[] = []
    let previous = -1
    for (let w = 0; w < weeks; w++) {
        const month = Number(days[w * 7].date.slice(5, 7)) - 1
        if (month !== previous) candidates.push({ week: w, label: MONTHS[month] })
        previous = month
    }
    return candidates.filter((m, i) => {
        const next = candidates[i + 1]?.week ?? weeks
        return next - m.week >= 3
    })
}

const LONG_DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** "24 oct 2026" para un YYYY-MM-DD. */
export function heatDate(date: string): string {
    return LONG_DATE.format(new Date(toMs(date))).replace('.', '')
}

function hoursText(minutes: number): string {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.round((minutes / 60) * 10) / 10
    return `${String(hours).replace('.', ',')} h`
}

/** Texto del día para el tooltip: "24 oct 2026 · 2,5 h · 3 logros", o "… · sin actividad". */
export function dayLabel(day: Pick<HeatDay, 'date' | 'minutes' | 'achievements'>): string {
    const parts = [heatDate(day.date)]
    if (day.minutes > 0) parts.push(hoursText(day.minutes))
    if (day.achievements > 0) parts.push(day.achievements === 1 ? '1 logro' : `${day.achievements} logros`)
    if (parts.length === 1) parts.push('sin actividad')
    return parts.join(' · ')
}

/** Resumen textual del mapa entero, para lectores de pantalla. */
export function heatmapSummary(map: Heatmap): string {
    const { minutes, achievements, activeDays } = map.totals
    if (activeDays === 0) return `Sin actividad registrada entre el ${heatDate(map.from)} y el ${heatDate(map.to)}.`
    const best = map.days.reduce((a, b) => (b.minutes > a.minutes || (b.minutes === a.minutes && b.achievements > a.achievements) ? b : a))
    const parts = [
        `Del ${heatDate(map.from)} al ${heatDate(map.to)}: ${activeDays} ${activeDays === 1 ? 'día' : 'días'} con actividad`,
        minutes > 0 ? `${hoursText(minutes)} registradas` : null,
        `${achievements} ${achievements === 1 ? 'logro' : 'logros'}`,
    ].filter(Boolean)
    return `${parts.join(', ')}. Día más activo: ${dayLabel(best)}.`
}

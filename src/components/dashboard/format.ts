// Fechas del dashboard, siempre en hora de Madrid (se pintan en el servidor).

const RELATIVE = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' })
const SHORT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' })

/**
 * "hace 5 minutos", "ayer", "hace 5 días", "hace 3 meses"… A partir de 20 h cuenta en días de calendario.
 * Solo pasado: una fecha posterior a `now` (relojes desfasados entre máquinas) cuenta como "hace un momento",
 * nunca "dentro de…".
 */
export function timeAgo(iso: string | null, now: number = Date.now()): string {
    if (!iso) return 'nunca'
    const seconds = Math.min(0, Math.round((Date.parse(iso) - now) / 1000))
    if (Math.abs(seconds) < 20 * 3600) {
        for (const [unit, size] of [['hour', 3600], ['minute', 60]] as const) {
            if (Math.abs(seconds) >= size) return RELATIVE.format(Math.round(seconds / size), unit)
        }
        return 'hace un momento'
    }
    const days = Math.round((madridDay(Date.parse(iso)) - madridDay(now)) / 86400_000)
    if (Math.abs(days) < 60) return RELATIVE.format(days, 'day')
    if (Math.abs(days) < 730) return RELATIVE.format(Math.round(days / 30), 'month')
    return RELATIVE.format(Math.round(days / 365), 'year')
}

const DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Medianoche (UTC) del día de Madrid de `ms`, para contar días de calendario. */
function madridDay(ms: number): number {
    return Date.parse(`${DAY.format(new Date(ms))}T00:00:00Z`)
}

export function shortDate(iso: string): string {
    return SHORT.format(new Date(iso))
}

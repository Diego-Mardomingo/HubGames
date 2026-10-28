// JUDI en mantenimiento: la flag `NEXT_PUBLIC_JUDI_MAINTENANCE` y, opcional, cuándo vuelve
// (`NEXT_PUBLIC_JUDI_MAINTENANCE_UNTIL`, fecha ISO). Las dos se fijan al desplegar; aquí solo la lógica pura.

const TZ = 'Europe/Madrid'
const DAY_MS = 24 * 60 * 60 * 1000

/** ¿JUDI está en mantenimiento? Next sustituye `process.env.NEXT_PUBLIC_*` al compilar, en el servidor y en el navegador. */
export function isJudiMaintenance(flag: string | undefined = process.env.NEXT_PUBLIC_JUDI_MAINTENANCE): boolean {
    return flag?.trim() === 'true'
}

/** La hora de vuelta configurada (`NEXT_PUBLIC_JUDI_MAINTENANCE_UNTIL`), o null si no hay o no se entiende. */
export function maintenanceUntilRaw(): string | undefined {
    return process.env.NEXT_PUBLIC_JUDI_MAINTENANCE_UNTIL
}

/** Lee la fecha ISO de vuelta («2026-10-29T18:30:00+01:00»). Vacía o inválida → null (se comporta como sin hora). */
export function parseMaintenanceUntil(raw: string | null | undefined): number | null {
    const value = raw?.trim()
    if (!value) return null
    // Solo fechas con día completo: evita que «18:30» o «mañana» se interpreten de forma rara.
    if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return null
    const ms = Date.parse(value)
    return Number.isFinite(ms) ? ms : null
}

/** Cuándo vuelve JUDI: sin hora, en menos de 24 h (cuenta atrás), otro día o con la hora ya pasada. */
export type MaintenanceReturn =
    | { kind: 'unset' }
    | { kind: 'soon'; msLeft: number; time: string }
    | { kind: 'later'; when: string }
    | { kind: 'overdue'; time: string }

/** Hora de Madrid como «18:30». */
export function madridTime(ms: number): string {
    return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(ms)
}

/** Día y hora de Madrid como «jueves, 29 de octubre, hacia las 10:00». */
export function madridDayAndTime(ms: number): string {
    const day = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }).format(ms)
    return `${day}, hacia las ${madridTime(ms)}`
}

export function maintenanceReturn(until: number | null, now: number): MaintenanceReturn {
    if (until === null) return { kind: 'unset' }
    const left = until - now
    if (left <= 0) return { kind: 'overdue', time: madridTime(until) }
    if (left < DAY_MS) return { kind: 'soon', msLeft: left, time: madridTime(until) }
    return { kind: 'later', when: madridDayAndTime(until) }
}

/** Texto de la tarjeta. Nunca promete la racha: solo lo que de verdad está guardado. */
export function maintenanceText(kind: MaintenanceReturn['kind'], signedIn: boolean): string {
    const saved = signedIn ? 'Tus partidas y tus puntos están guardados.' : 'Tu progreso en este dispositivo está guardado.'
    const base = `Estamos haciendo cambios en el juego del día. ${saved}`
    if (kind === 'unset') return `${base} Vuelve en un rato.`
    if (kind === 'overdue') return `${base} Está tardando más de lo previsto: vuelve a mirar en un rato.`
    return base
}

/** Una línea corta para el Inicio («Vuelve hacia las 18:30», «Vuelve el jueves…», «Vuelve en un rato»). */
export function maintenanceReturnLine(ret: MaintenanceReturn): string {
    if (ret.kind === 'soon') return `Vuelve hacia las ${ret.time}.`
    if (ret.kind === 'later') return `Vuelve el ${ret.when}.`
    if (ret.kind === 'overdue') return 'Está tardando más de lo previsto.'
    return 'Vuelve en un rato.'
}

/** Cuenta atrás «01:42:10» (también la de la tarjeta del día de JUDI). */
export function formatHmsCountdown(ms: number): string {
    const totalSec = Math.max(0, Math.floor(ms / 1000))
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

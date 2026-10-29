/**
 * Lógica pura del movimiento de la biblioteca y la ficha: qué le pasa a una fila al cambiar un juego (sale de la lista,
 * cambia de puesto o se queda), el cambio que se guarda al elegir un estado y cómo cuenta una cifra de horas.
 */
import type { GameStatus, LibraryGame } from './tracker'

export type RowChange = { kind: 'leave'; index: number } | { kind: 'move'; from: number; to: number } | { kind: 'stay' } | { kind: 'none' }

/**
 * Qué le pasa a la fila de `appid` entre dos listas visibles (ids en orden): sale (y en qué puesto estaba), cambia de
 * puesto, se queda donde estaba o no estaba (`none`; si aparece, entra sin más).
 */
export function rowChange(before: readonly number[], after: readonly number[], appid: number): RowChange {
    const from = before.indexOf(appid)
    if (from < 0) return { kind: 'none' }
    const to = after.indexOf(appid)
    if (to < 0) return { kind: 'leave', index: from }
    // El puesto cuenta entre las filas que siguen: si sale otra de encima, no es un cambio de puesto.
    const common = new Set(after)
    const prevRank = before.filter((id) => common.has(id)).indexOf(appid)
    return prevRank === to ? { kind: 'stay' } : { kind: 'move', from, to }
}

/**
 * Cambio que se guarda al pasar un juego a `status` desde el menú de la biblioteca (el mismo que el menú hacía al
 * guardar). `suggested`: la fecha de completado sugerida (`suggestedCompletionDate`); sin ella, ahora.
 */
export function statusPatch(game: LibraryGame, status: GameStatus, now: string, suggested: string | null = null): Partial<LibraryGame> {
    if (status === 'completado') return { status, status_source: 'manual', suggestion: null, completed_at: suggested ?? now }
    return {
        status,
        status_source: 'manual',
        suggestion: null,
        status_changed_at: now,
        ...(status === 'jugando' && !game.started_at && { started_at: now }),
    }
}

/**
 * Cifra de horas para contar (`CountUp`) con la misma unidad que `formatHours`: minutos por debajo de 1 h, horas con
 * un decimal por debajo de 10 h y horas enteras a partir de ahí. Cuenta en la unidad del valor final.
 */
export function hoursCount(minutes: number): { value: number; decimals: number; suffix: string } {
    if (minutes < 60) return { value: Math.max(0, Math.round(minutes)), decimals: 0, suffix: minutes === 0 ? 'h' : 'min' }
    const hours = minutes / 60
    if (hours < 10) return { value: Math.round(hours * 10) / 10, decimals: 1, suffix: 'h' }
    return { value: Math.round(hours), decimals: 0, suffix: 'h' }
}

/** Posición (0–1) de una meta dentro del relleno de la pista: cuándo la alcanza la barra al rellenarse. */
export function markReachedAt(markMinutes: number, played: number): number {
    if (played <= 0) return 1
    return Math.min(1, Math.max(0, markMinutes / played))
}

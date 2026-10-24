// Reglas de estados automáticos (#18). Puras (sin base de datos) para poder probarlas: tracker-rules.test.ts.
import type { GameStatus } from './tracker'

export type Suggestion = 'pausado' | 'completado'

const DAY_MS = 24 * 3600_000
/** Jugado en las últimas 2 semanas = "Jugando". */
export const PLAYING_WINDOW_MS = 14 * DAY_MS
/** Más de 30 días sin jugar estando en "Jugando" = se sugiere "Pausado". */
export const IDLE_WINDOW_MS = 30 * DAY_MS

/** Estados que pasan solos a "Jugando" si hay actividad. */
const AUTO_PLAYING_FROM: GameStatus[] = ['bandeja', 'pendiente', 'pausado']
/** Estados cerrados: nunca se tocan ni reciben sugerencias. */
const CLOSED: GameStatus[] = ['completado', 'abandonado', 'descartado']

export interface RuleInput {
    status: GameStatus
    status_source: string
    status_changed_at: string
    rtime_last_played: string | null
    playtime_forever: number
    playtime_2weeks: number
    achievements_total: number | null
    achievements_unlocked: number | null
    last_unlock_at: string | null
    suggestion_dismissed_at: string | null
    /** Duración de la historia según HowLongToBeat, en minutos (#23). Mientras no exista, null. */
    hltb_main_minutes?: number | null
}

export interface RuleOutput {
    status: GameStatus
    /** true si la regla ha cambiado el estado (se guarda con status_source = 'auto'). */
    statusChanged: boolean
    suggestion: Suggestion | null
}

/** Todos los logros desbloqueados: insignia 100%. */
export function isPerfect(game: Pick<RuleInput, 'achievements_total' | 'achievements_unlocked'>): boolean {
    return (game.achievements_total ?? 0) > 0 && (game.achievements_unlocked ?? 0) >= (game.achievements_total ?? 0)
}

function ms(iso: string | null): number | null {
    return iso ? Date.parse(iso) : null
}

export function evaluateGame(game: RuleInput, now: number = Date.now()): RuleOutput {
    const lastPlayed = ms(game.rtime_last_played)
    const changedAt = ms(game.status_changed_at) ?? 0
    const playedRecently = game.playtime_2weeks > 0 || (lastPlayed !== null && now - lastPlayed <= PLAYING_WINDOW_MS)

    let status = game.status
    let statusChanged = false

    // Regla 1: actividad reciente → Jugando. Una decisión manual solo la revoca una partida posterior a ella.
    if (AUTO_PLAYING_FROM.includes(status) && playedRecently) {
        const manual = game.status_source === 'manual'
        if (!manual || (lastPlayed !== null && lastPlayed > changedAt)) {
            status = 'jugando'
            statusChanged = true
        }
    }

    if (CLOSED.includes(status)) return { status, statusChanged, suggestion: null }

    // Una sugerencia descartada no se repite por el mismo motivo: solo si pasa algo después del descarte.
    const dismissed = ms(game.suggestion_dismissed_at)
    const dismissedAfter = (at: number | null) => dismissed !== null && dismissed >= (at ?? 0)

    // Regla 2: 100% de logros → ¿Lo has terminado? (el 100% se alcanzó con el último desbloqueo).
    if (isPerfect(game) && !dismissedAfter(ms(game.last_unlock_at))) {
        return { status, statusChanged, suggestion: 'completado' }
    }
    // Regla 3: más horas que la historia según HowLongToBeat → ¿Lo has terminado? Tras descartarla, solo si cambia el estado.
    const beatHltb = Boolean(game.hltb_main_minutes && game.playtime_forever >= game.hltb_main_minutes)
    if (beatHltb && !dismissedAfter(changedAt)) return { status, statusChanged, suggestion: 'completado' }

    // Regla 4: en Jugando y más de 30 días sin jugar (ni cambios de estado) → ¿Lo dejas en pausa?
    // Tras descartarla, vuelve si se juega otra vez y se deja de nuevo.
    if (status === 'jugando' && !statusChanged) {
        const lastActivity = Math.max(lastPlayed ?? 0, changedAt)
        if (game.playtime_2weeks === 0 && now - lastActivity > IDLE_WINDOW_MS && !dismissedAfter(lastActivity)) {
            return { status, statusChanged, suggestion: 'pausado' }
        }
    }

    return { status, statusChanged, suggestion: null }
}

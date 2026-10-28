// Panel de sugerencias del Inicio (#18): agrupar y ordenar, la prueba de cada pregunta (por qué te lo preguntamos) y
// cuándo volverá a preguntar tras descartarla. Puro (sin base de datos), con tests en suggestions.test.ts.
// Las pruebas salen de las mismas reglas que generan la sugerencia: `evaluateGame` en tracker-rules.ts.
import { goalMinutes, parseGoal, type GameGoal } from './game-goal'
import { gameDuration } from './library'
import type { LibraryGame } from './tracker'
import { isPerfect, type Suggestion } from './tracker-rules'

const DAY_MS = 24 * 3600_000

/** Destinos en el orden en que se enseñan: primero lo más gratificante (completar), luego las pausas. */
export const SUGGESTION_KINDS: readonly Suggestion[] = ['completado', 'pausado']

/** Textos de cada pregunta: la cabecera del grupo, las dos respuestas, el resumen y la regla que la genera. */
export const SUGGESTION_COPY: Record<Suggestion, { question: string; yes: string; no: string; summary: string; rule: string }> = {
    completado: {
        question: '¿Lo has terminado?',
        yes: 'Sí, completado',
        no: 'Todavía no',
        summary: 'por completar',
        rule: 'Has llegado al 100 % de logros o a tu meta de horas',
    },
    pausado: {
        question: '¿Lo dejas en pausa?',
        yes: 'Pausar',
        no: 'Sigo con él',
        summary: 'por pausar',
        rule: 'En Jugando y más de 30 días sin jugar',
    },
}

/** Cuántas filas se ven antes de «Ver N más». */
export const SUGGESTIONS_VISIBLE = 4

export type SuggestionGame = Pick<
    LibraryGame,
    | 'appid'
    | 'suggestion'
    | 'status'
    | 'status_changed_at'
    | 'rtime_last_played'
    | 'playtime_forever'
    | 'achievements_total'
    | 'achievements_unlocked'
    | 'last_unlock_at'
    | 'goal'
    | 'endless'
    | 'hltb_main'
    | 'hltb_main_extra'
    | 'hltb_completionist'
    | 'steamspy_median_forever'
>

export function parseSuggestion(s: string | null | undefined): Suggestion | null {
    return s === 'completado' || s === 'pausado' ? s : null
}

const lastPlayedMs = (g: Pick<LibraryGame, 'rtime_last_played'>) => (g.rtime_last_played ? Date.parse(g.rtime_last_played) : -Infinity)

export interface SuggestionGroup<G> {
    kind: Suggestion
    games: G[]
}

/** Grupos por lista de destino (completar y luego pausar), cada uno por última partida (la más reciente arriba). Sin vacíos. */
export function groupSuggestions<G extends Pick<LibraryGame, 'appid' | 'suggestion' | 'rtime_last_played'>>(games: G[]): SuggestionGroup<G>[] {
    return SUGGESTION_KINDS.map((kind) => ({
        kind,
        games: games
            .filter((g) => parseSuggestion(g.suggestion) === kind)
            .sort((a, b) => lastPlayedMs(b) - lastPlayedMs(a) || a.appid - b.appid),
    })).filter((g) => g.games.length > 0)
}

/**
 * Recorta los grupos a las `limit` primeras filas del panel (en el orden de los grupos) y dice cuántas quedan ocultas.
 * Al responder una, sube la siguiente.
 */
export function limitGroups<G>(groups: SuggestionGroup<G>[], limit: number): { groups: SuggestionGroup<G>[]; hidden: number } {
    let left = limit
    let hidden = 0
    const out: SuggestionGroup<G>[] = []
    for (const group of groups) {
        const shown = group.games.slice(0, Math.max(0, left))
        hidden += group.games.length - shown.length
        left -= shown.length
        if (shown.length) out.push({ kind: group.kind, games: shown })
    }
    return { groups: out, hidden }
}

/** La prueba: por qué preguntamos. */
export type SuggestionEvidence =
    /** Regla 2: 100 % de logros. `daysSinceUnlock`: días desde el último (null sin fecha). */
    | { kind: 'completado'; why: 'logros'; unlocked: number; total: number; lastUnlockAt: string | null; daysSinceUnlock: number | null }
    /** Regla 3: más horas que la meta de tu objetivo según HowLongToBeat. */
    | { kind: 'completado'; why: 'horas'; minutes: number; targetMinutes: number; goal: GameGoal }
    /** Regla 4: en Jugando y más de 30 días sin jugar. `storyMinutes`: dónde lo dejaste frente a la historia. */
    | { kind: 'pausado'; why: 'inactivo'; idleDays: number; since: string | null; minutes: number; storyMinutes: number | null }
    /** La regla ya no se cumple con los datos de hoy (p. ej. cambió la duración): solo la pregunta. */
    | { kind: Suggestion; why: 'otro' }

/** Minutos de la meta que usa la regla 3 (sin la mediana de SteamSpy, como en la sincronización). */
function ruleTarget(game: SuggestionGame): number | null {
    if (!game.goal) return game.hltb_main && game.hltb_main > 0 ? game.hltb_main : null
    return goalMinutes({ ...game, steamspy_median_forever: null })
}

const daysBetween = (from: number, now: number) => Math.max(0, Math.floor((now - from) / DAY_MS))

export function suggestionEvidence(game: SuggestionGame, now: number = Date.now()): SuggestionEvidence | null {
    const kind = parseSuggestion(game.suggestion)
    if (!kind) return null
    if (kind === 'completado') {
        if (isPerfect(game)) {
            const at = game.last_unlock_at ? Date.parse(game.last_unlock_at) : null
            return {
                kind,
                why: 'logros',
                unlocked: game.achievements_unlocked ?? 0,
                total: game.achievements_total ?? 0,
                lastUnlockAt: game.last_unlock_at,
                daysSinceUnlock: at === null ? null : daysBetween(at, now),
            }
        }
        const target = ruleTarget(game)
        if (target && game.playtime_forever >= target) {
            return { kind, why: 'horas', minutes: game.playtime_forever, targetMinutes: target, goal: game.goal ? parseGoal(game.goal) : 'historia' }
        }
        return { kind, why: 'otro' }
    }
    const played = game.rtime_last_played ? Date.parse(game.rtime_last_played) : null
    const changed = game.status_changed_at ? Date.parse(game.status_changed_at) : null
    const last = Math.max(played ?? 0, changed ?? 0)
    if (!last) return { kind, why: 'otro' }
    return {
        kind,
        why: 'inactivo',
        idleDays: daysBetween(last, now),
        since: played !== null && played >= (changed ?? 0) ? game.rtime_last_played : game.status_changed_at,
        minutes: game.playtime_forever,
        storyMinutes: gameDuration(game).main,
    }
}

/** Cuándo volverá a preguntar tras «Todavía no» / «Sigo con él» (las condiciones de `evaluateGame`). */
export function dismissReason(evidence: SuggestionEvidence | null): string {
    if (evidence?.kind === 'pausado') return 'Volveremos a preguntar si lo juegas y lo dejas otro mes.'
    if (evidence?.why === 'logros') return 'No volveremos a preguntar hasta que consigas otro logro.'
    return 'No volveremos a preguntar hasta que cambies su estado.'
}

/** Minutos → «31,5 h», «27 h», «45 min» (un decimal si hace falta: la diferencia con la meta se nota). */
export function formatHoursExact(minutes: number): string {
    if (minutes < 60) return `${Math.max(0, Math.round(minutes))} min`
    const hours = Math.round((minutes / 60) * 10) / 10
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1).replace('.', ',')} h`
}

/** Texto de la meta tras «31,5 h de 27 h …»: la historia a secas; con otro objetivo, se nombra. */
export function goalPhrase(goal: GameGoal, short = false): string {
    if (goal === 'extras') return short ? 'de historia + extras' : 'de historia + extras, tu objetivo'
    if (goal === 'completo') return short ? 'para completarlo todo' : 'para completarlo todo, tu objetivo'
    return 'de historia'
}

/** «hoy», «ayer», «hace 5 días», «hace 3 meses». */
export function daysAgo(days: number): string {
    if (days <= 0) return 'hoy'
    if (days === 1) return 'ayer'
    if (days < 60) return `hace ${days} días`
    if (days < 730) return `hace ${Math.round(days / 30)} meses`
    return `hace ${Math.round(days / 365)} años`
}

/** Barra frente a la meta: relleno (0-1) y posición de la marca (0-1). Al pasarla, la barra llega al final y la marca queda dentro. */
export function goalBar(minutes: number, target: number): { fill: number; mark: number; over: boolean } {
    if (target <= 0) return { fill: 0, mark: 1, over: false }
    const over = minutes >= target
    const max = over ? Math.max(minutes, 1) : target
    return { fill: Math.min(minutes, max) / max, mark: target / max, over }
}


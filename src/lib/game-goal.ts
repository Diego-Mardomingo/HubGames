// Objetivo por juego (#24): historia, historia + extras, 100 % o rejugable (sin final, se marca a mano). Puro (sin base de datos), con tests en game-goal.test.ts.
import type { LibraryGame } from './tracker'
import { achievementPercent, gameDuration } from './library'

export const GAME_GOALS = ['historia', 'extras', 'completo', 'rejugable'] as const
export type GameGoal = (typeof GAME_GOALS)[number]

export const GOAL_LABELS: Record<GameGoal, string> = {
    historia: 'Historia',
    extras: 'Historia + extras',
    completo: '100 %',
    rejugable: 'Rejugable',
}

export function parseGoal(goal: string | null | undefined): GameGoal {
    return GAME_GOALS.includes(goal as GameGoal) ? (goal as GameGoal) : 'historia'
}

/** Juego sin final (multijugador, sandbox, roguelike...): no se mide por horas ni se espera terminarlo. */
export function isReplayable(game: Pick<LibraryGame, 'goal'>): boolean {
    return parseGoal(game.goal) === 'rejugable'
}

type GoalColumns =
    | 'goal'
    | 'playtime_forever'
    | 'achievements_total'
    | 'achievements_unlocked'
    | 'hltb_main'
    | 'hltb_main_extra'
    | 'hltb_completionist'
    | 'steamspy_median_forever'

/** Minutos que marca la meta del objetivo: historia, historia + extras o 100 % según HowLongToBeat. null sin dato o si es rejugable. */
export function goalMinutes(game: Pick<LibraryGame, GoalColumns>): number | null {
    const goal = parseGoal(game.goal)
    if (goal === 'rejugable') return null
    const d = gameDuration(game)
    if (goal === 'extras') return d.mainExtra
    if (goal === 'completo') return d.completionist
    return d.main
}

export interface GoalProgress {
    goal: GameGoal
    /** Cómo se mide: por horas frente a la duración, o por % de logros (100 % con logros). */
    basis: 'horas' | 'logros'
    /** 0-100, o null si no hay con qué medirlo. */
    percent: number | null
    /** Minutos de la meta (solo por horas). */
    targetMinutes: number | null
    done: boolean
}

/**
 * Progreso según el objetivo: historia y extras comparan tus horas con HowLongToBeat; el 100 % es el % de logros
 * (si el juego no tiene logros, las horas frente a la duración "completista").
 */
export function goalProgress(game: Pick<LibraryGame, GoalColumns>): GoalProgress {
    const goal = parseGoal(game.goal)
    if (goal === 'completo') {
        const pct = achievementPercent(game)
        if (pct !== null) return { goal, basis: 'logros', percent: pct, targetMinutes: null, done: pct >= 100 }
    }
    const target = goalMinutes(game)
    if (!target) return { goal, basis: 'horas', percent: null, targetMinutes: null, done: false }
    const percent = Math.min(100, Math.floor((game.playtime_forever / target) * 100))
    return { goal, basis: 'horas', percent, targetMinutes: target, done: game.playtime_forever >= target }
}

/** Minutos que faltan para la meta del objetivo (0 si ya se ha pasado), o null sin duración o si se mide por logros. */
export function goalRemainingMinutes(game: Pick<LibraryGame, GoalColumns>): number | null {
    const p = goalProgress(game)
    if (p.basis !== 'horas' || p.targetMinutes === null) return null
    return Math.max(0, p.targetMinutes - game.playtime_forever)
}

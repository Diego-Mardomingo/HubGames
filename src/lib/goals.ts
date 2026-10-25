// Metas mensuales (#31): "terminar 2 juegos", "50 logros", "1 juego al 100 %". El progreso sale solo de los datos
// sincronizados y la propuesta, de tu media de los últimos meses. Puro, con tests en goals.test.ts.
import type { LibraryGame } from './tracker'

export const GOAL_KINDS = ['completar', 'logros', 'perfectos'] as const
export type GoalKind = (typeof GOAL_KINDS)[number]

export const GOAL_LABELS: Record<GoalKind, { one: string; many: string }> = {
    completar: { one: 'juego terminado', many: 'juegos terminados' },
    logros: { one: 'logro', many: 'logros' },
    perfectos: { one: 'juego al 100 %', many: 'juegos al 100 %' },
}

export const GOAL_MAX: Record<GoalKind, number> = { completar: 30, logros: 1000, perfectos: 30 }

/** Meses completos anteriores que cuentan para la media. */
export const AVERAGE_MONTHS = 6

const TZ = 'Europe/Madrid'

/** Primer día del mes en Madrid, "YYYY-MM-01" (columna `month` de hubgames_monthly_goals). */
export function monthKey(date: Date | string | number): string {
    const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' })
        .format(new Date(date))
        .split('-')
    return `${y}-${m}-01`
}

/** "octubre" */
export function monthName(key: string): string {
    return new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`))
}

/** Las `n` claves de mes anteriores a `key`, de la más reciente a la más antigua. */
export function previousMonths(key: string, n: number): string[] {
    const [y, m] = key.split('-').map(Number)
    return Array.from({ length: n }, (_, i) => {
        const d = new Date(Date.UTC(y, m - 2 - i, 1))
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
    })
}

type GoalGame = Pick<LibraryGame, 'status' | 'completed_at' | 'achievements_total' | 'achievements_unlocked' | 'last_unlock_at'>

/** Cuántas veces ha pasado cada cosa en cada mes. `unlocks`: fechas de tus logros desbloqueados. */
export function countsByMonth(games: GoalGame[], unlocks: string[]): Record<GoalKind, Map<string, number>> {
    const out = { completar: new Map<string, number>(), logros: new Map<string, number>(), perfectos: new Map<string, number>() }
    const add = (kind: GoalKind, iso: string) => {
        const key = monthKey(iso)
        out[kind].set(key, (out[kind].get(key) ?? 0) + 1)
    }
    for (const g of games) {
        if (g.status === 'completado' && g.completed_at) add('completar', g.completed_at)
        // El 100 % se alcanzó con el último desbloqueo.
        const total = g.achievements_total ?? 0
        if (total > 0 && (g.achievements_unlocked ?? 0) >= total && g.last_unlock_at) add('perfectos', g.last_unlock_at)
    }
    for (const at of unlocks) add('logros', at)
    return out
}

export function progressFor(counts: Record<GoalKind, Map<string, number>>, month: string): Record<GoalKind, number> {
    return { completar: counts.completar.get(month) ?? 0, logros: counts.logros.get(month) ?? 0, perfectos: counts.perfectos.get(month) ?? 0 }
}

/**
 * Propuesta para el mes: tu media de los últimos meses con un pequeño empujón, redondeada.
 * Los logros, a múltiplos de 5. Nunca menos de 1 (ni de 5 logros).
 */
export function suggestTargets(counts: Record<GoalKind, Map<string, number>>, month: string): Record<GoalKind, number> {
    const months = previousMonths(month, AVERAGE_MONTHS)
    const avg = (kind: GoalKind) => months.reduce((s, m) => s + (counts[kind].get(m) ?? 0), 0) / months.length
    const clamp = (kind: GoalKind, n: number) => Math.min(GOAL_MAX[kind], n)
    return {
        completar: clamp('completar', Math.max(1, Math.ceil(avg('completar') * 1.1))),
        logros: clamp('logros', Math.max(5, Math.ceil((avg('logros') * 1.1) / 5) * 5)),
        perfectos: clamp('perfectos', Math.max(1, Math.ceil(avg('perfectos')))),
    }
}

/** Fracción del mes que ha pasado (0-1), para decir si vas al día. */
export function monthElapsed(month: string, now: Date = new Date()): number {
    const [y, m] = month.split('-').map(Number)
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const today = Number(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, day: '2-digit' }).format(now))
    return monthKey(now) === month ? today / days : monthKey(now) > month ? 1 : 0
}

export type GoalPace = 'cumplida' | 'al_dia' | 'por_detras'

export function goalPace(done: number, target: number, elapsed: number): GoalPace {
    if (done >= target) return 'cumplida'
    return done >= Math.floor(target * elapsed) ? 'al_dia' : 'por_detras'
}

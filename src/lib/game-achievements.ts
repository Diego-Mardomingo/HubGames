// Logros de un juego (/juego/[appid]/logros): filtro de estado combinado con el de rareza, recuentos que tienen en
// cuenta el otro filtro, resumen por rareza y fecha del último logro. Puro, con tests en game-achievements.test.ts.
import {
    achievementPoints,
    matchesAchievementFilter,
    sortAchievements,
    type Achievement,
    type AchievementFilter,
    type AchievementSort,
    type Difficulty,
} from './achievements'
import { RARITY_TIERS, rarityTier, type RarityTier } from './rarity'

export const ACHIEVEMENT_FILTERS: readonly AchievementFilter[] = ['todos', 'bloqueados', 'desbloqueados', 'ocultos']

/** Con un filtro de rareza, solo los de esa rareza; los que no tienen dato de Steam solo salen sin filtro («Todas»). */
export function matchesRarity(a: Pick<Achievement, 'global_percent'>, rarity: RarityTier | null): boolean {
    return rarity === null || rarityTier(a.global_percent) === rarity
}

/** Lo que se ve: los dos filtros a la vez y el orden elegido. */
export function filterAchievements(list: Achievement[], filter: AchievementFilter, rarity: RarityTier | null, sort: AchievementSort): Achievement[] {
    return sortAchievements(
        list.filter((a) => matchesAchievementFilter(a, filter) && matchesRarity(a, rarity)),
        sort,
    )
}

/** Recuento de cada filtro de estado dentro de la rareza elegida (o de todos, sin rareza). */
export function stateCounts(list: Pick<Achievement, 'achieved' | 'hidden' | 'global_percent'>[], rarity: RarityTier | null): Record<AchievementFilter, number> {
    const counts: Record<AchievementFilter, number> = { todos: 0, bloqueados: 0, desbloqueados: 0, ocultos: 0 }
    for (const a of list) {
        if (!matchesRarity(a, rarity)) continue
        for (const f of ACHIEVEMENT_FILTERS) if (matchesAchievementFilter(a, f)) counts[f]++
    }
    return counts
}

export interface RarityColumn {
    tier: RarityTier
    unlocked: number
    total: number
    /** Puntos de cazador que llevas en esta rareza y los que da en total. */
    earned: number
    possible: number
}

/** Columnas por rareza del resumen, de común a legendaria; solo las rarezas que tiene el juego. */
export function rarityColumns(list: Pick<Achievement, 'achieved' | 'global_percent'>[]): RarityColumn[] {
    const rows = RARITY_TIERS.map((tier): RarityColumn => ({ tier, unlocked: 0, total: 0, earned: 0, possible: 0 }))
    for (const a of list) {
        const tier = rarityTier(a.global_percent)
        if (!tier) continue
        const row = rows[RARITY_TIERS.indexOf(tier)]
        const points = achievementPoints(a.global_percent)
        row.total++
        row.possible += points
        if (a.achieved) {
            row.unlocked++
            row.earned += points
        }
    }
    return rows.filter((r) => r.total > 0)
}

/** Fecha (ISO) del último logro desbloqueado, o null. */
export function lastUnlock(list: Pick<Achievement, 'achieved' | 'unlocktime'>[]): string | null {
    let best: string | null = null
    let bestMs = -Infinity
    for (const a of list) {
        if (!a.achieved || !a.unlocktime) continue
        const ms = Date.parse(a.unlocktime)
        if (ms > bestMs) {
            bestMs = ms
            best = a.unlocktime
        }
    }
    return best
}

/** La dificultad reutiliza la escala de rarezas para su color (fácil = común … muy difícil = legendaria). */
export const DIFFICULTY_TIERS: Record<Difficulty, RarityTier> = {
    facil: 'comun',
    asequible: 'poco',
    exigente: 'rara',
    dificil: 'epica',
    muy_dificil: 'leg',
}

/** Por encima de este número de logros, la lista no se recoloca con desplazamiento al filtrar: solo funde. */
export const LAYOUT_ANIMATION_LIMIT = 150

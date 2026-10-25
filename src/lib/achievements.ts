// Logros (#25): tipos de la vista hubgames_achievements, rareza, filtros y dificultad. Sin acceso a la base de datos,
// con tests en achievements.test.ts.
import type { Database } from './supabase/database.types'

type AchievementRow = Database['public']['Tables']['hubgames_achievements']['Row']

/** Fila de hubgames_achievements. La vista marca todo como nullable; estas columnas nunca lo son. */
export type Achievement = Omit<AchievementRow, 'user_id' | 'appid' | 'apiname' | 'achieved' | 'hidden'> & {
    appid: number
    apiname: string
    achieved: boolean
    hidden: boolean
}

export const ACHIEVEMENT_COLUMNS = 'appid, apiname, achieved, unlocktime, display_name, description, icon, icongray, hidden, global_percent'

export type Rarity = 'comun' | 'poco_comun' | 'raro' | 'muy_raro' | 'ultra_raro'

export const RARITY_LABELS: Record<Rarity, string> = {
    comun: 'Común',
    poco_comun: 'Poco común',
    raro: 'Raro',
    muy_raro: 'Muy raro',
    ultra_raro: 'Ultra raro',
}

/** Nivel de rareza según el % global de jugadores que lo tienen. null si Steam no da el dato. */
export function rarity(percent: number | null): Rarity | null {
    if (percent === null) return null
    if (percent > 50) return 'comun'
    if (percent >= 20) return 'poco_comun'
    if (percent >= 5) return 'raro'
    if (percent >= 1) return 'muy_raro'
    return 'ultra_raro'
}

export function formatPercent(percent: number | null): string {
    if (percent === null) return '—'
    return `${percent < 10 ? percent.toFixed(1).replace('.', ',') : Math.round(percent)} %`
}

export type AchievementFilter = 'todos' | 'bloqueados' | 'desbloqueados' | 'ocultos'
export type AchievementSort = 'rareza' | 'fecha' | 'nombre'

export const ACHIEVEMENT_FILTER_LABELS: Record<AchievementFilter, string> = {
    todos: 'Todos',
    bloqueados: 'Bloqueados',
    desbloqueados: 'Desbloqueados',
    ocultos: 'Ocultos',
}

export const ACHIEVEMENT_SORT_LABELS: Record<AchievementSort, string> = {
    rareza: 'Más raros primero',
    fecha: 'Desbloqueados recientemente',
    nombre: 'Nombre',
}

export function matchesAchievementFilter(a: Pick<Achievement, 'achieved' | 'hidden'>, filter: AchievementFilter): boolean {
    switch (filter) {
        case 'bloqueados':
            return !a.achieved
        case 'desbloqueados':
            return a.achieved
        case 'ocultos':
            return a.hidden
        default:
            return true
    }
}

const byName = (a: Achievement, b: Achievement) => (a.display_name ?? a.apiname).localeCompare(b.display_name ?? b.apiname, 'es')

/** Sin % global, al final en "rareza". En "fecha", los bloqueados van detrás de los desbloqueados. */
export function sortAchievements(list: Achievement[], sort: AchievementSort): Achievement[] {
    const cmp: Record<AchievementSort, (a: Achievement, b: Achievement) => number> = {
        rareza: (a, b) => (a.global_percent ?? Infinity) - (b.global_percent ?? Infinity) || 0,
        fecha: (a, b) => (b.unlocktime ? Date.parse(b.unlocktime) : -Infinity) - (a.unlocktime ? Date.parse(a.unlocktime) : -Infinity) || 0,
        nombre: () => 0,
    }
    return [...list].sort((a, b) => cmp[sort](a, b) || byName(a, b))
}

export type Difficulty = 'facil' | 'asequible' | 'exigente' | 'dificil' | 'muy_dificil'

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
    facil: 'Fácil',
    asequible: 'Asequible',
    exigente: 'Exigente',
    dificil: 'Difícil',
    muy_dificil: 'Muy difícil',
}

export interface DifficultyEstimate {
    level: Difficulty
    /** Logros que te faltan. */
    remaining: number
    /** % global del más raro que te falta: el que marca el techo para el 100 %. */
    rarest: number | null
    /** Cuántos de los que faltan son raros o más (menos del 20 %). */
    hard: number
}

/**
 * Dificultad estimada de lo que te queda. El 100 % depende sobre todo del logro más raro que falta,
 * así que ese marca el nivel; si además faltan muchos raros, sube un escalón. null si no falta ninguno.
 */
export function estimateDifficulty(list: Pick<Achievement, 'achieved' | 'global_percent'>[]): DifficultyEstimate | null {
    const locked = list.filter((a) => !a.achieved)
    if (locked.length === 0) return null
    const percents = locked.map((a) => a.global_percent).filter((p): p is number => p !== null)
    const rarest = percents.length > 0 ? Math.min(...percents) : null
    const hard = percents.filter((p) => p < 20).length
    const levels: Difficulty[] = ['facil', 'asequible', 'exigente', 'dificil', 'muy_dificil']
    const tiers: Rarity[] = ['comun', 'poco_comun', 'raro', 'muy_raro', 'ultra_raro']
    let index = rarest === null ? 1 : tiers.indexOf(rarity(rarest)!)
    if (hard >= 10 && index < levels.length - 1) index++
    return { level: levels[index], remaining: locked.length, rarest, hard }
}

export function steamGuidesUrl(appid: number): string {
    return `https://steamcommunity.com/app/${appid}/guides`
}

export function youtubeSearchUrl(gameName: string, achievementName: string): string {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${gameName} ${achievementName} logro`)}`
}

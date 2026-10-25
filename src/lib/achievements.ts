// Logros (#25, #26): tipos de la vista hubgames_achievements, rareza, filtros, dificultad y vistas de cazador.
// Sin acceso a la base de datos, con tests en achievements.test.ts.
import type { Database } from './supabase/database.types'
import type { LibraryGame } from './tracker'

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

// ── Vistas de cazador (#26) ──

type GameProgress = Pick<LibraryGame, 'appid' | 'achievements_total' | 'achievements_unlocked' | 'rtime_last_played' | 'last_unlock_at'>

const DAY_MS = 24 * 3600_000
/** Sin jugar ni desbloquear nada en este tiempo = "olvidado". */
export const FORGOTTEN_AFTER_MS = 90 * DAY_MS
/** A partir de este % de logros, un juego cuenta como "cerca del 100 %". */
export const NEAR_COMPLETION_PERCENT = 50

function progress(game: GameProgress): { total: number; unlocked: number; remaining: number; percent: number } {
    const total = game.achievements_total ?? 0
    const unlocked = Math.min(game.achievements_unlocked ?? 0, total)
    return { total, unlocked, remaining: total - unlocked, percent: total > 0 ? (unlocked / total) * 100 : 0 }
}

/** Última vez que tocaste el juego: la partida o el desbloqueo más reciente. */
export function lastTouched(game: Pick<GameProgress, 'rtime_last_played' | 'last_unlock_at'>): number | null {
    const times = [game.rtime_last_played, game.last_unlock_at].filter((t): t is string => !!t).map(Date.parse)
    return times.length > 0 ? Math.max(...times) : null
}

/** Juegos con al menos la mitad de los logros y sin el 100 %, de menos a más logros restantes. */
export function nearCompletion<T extends GameProgress>(games: T[]): T[] {
    return games
        .filter((g) => {
            const p = progress(g)
            return p.remaining > 0 && p.percent >= NEAR_COMPLETION_PERCENT
        })
        .sort((a, b) => progress(a).remaining - progress(b).remaining || progress(b).percent - progress(a).percent)
}

/** Juegos con más del 50 % de logros, sin el 100 % y sin tocar desde hace más de 90 días. Los más avanzados primero. */
export function forgottenGames<T extends GameProgress>(games: T[], now: number = Date.now()): T[] {
    return games
        .filter((g) => {
            const p = progress(g)
            const touched = lastTouched(g)
            return p.remaining > 0 && p.percent > NEAR_COMPLETION_PERCENT && touched !== null && now - touched > FORGOTTEN_AFTER_MS
        })
        .sort((a, b) => progress(b).percent - progress(a).percent)
}

/** Juegos con todos los logros, del 100 % más reciente al más antiguo. */
export function perfectGames<T extends GameProgress>(games: T[]): T[] {
    return games
        .filter((g) => {
            const p = progress(g)
            return p.total > 0 && p.remaining === 0
        })
        .sort((a, b) => (b.last_unlock_at ? Date.parse(b.last_unlock_at) : 0) - (a.last_unlock_at ? Date.parse(a.last_unlock_at) : 0))
}

/** Tus logros desbloqueados más raros (los que no tienen % global no cuentan). */
export function rarestUnlocked(list: Achievement[], limit: number): Achievement[] {
    return list
        .filter((a) => a.achieved && a.global_percent !== null)
        .sort((a, b) => a.global_percent! - b.global_percent!)
        .slice(0, limit)
}

export function remainingAchievements(game: GameProgress): number {
    return progress(game).remaining
}

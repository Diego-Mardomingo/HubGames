// Logros (#25, #26, #27): tipos de la vista hubgames_achievements, filtros, dificultad, vistas de cazador,
// puntos e hitos. La rareza vive en rarity.ts. Sin acceso a la base de datos, con tests en achievements.test.ts.
import type { Database } from './supabase/database.types'
import type { LibraryGame } from './tracker'
import { RARITY_TIERS, rarityTier, type RarityTier } from './rarity'

type AchievementRow = Database['public']['Tables']['hubgames_achievements']['Row']

/** Fila de hubgames_achievements. La vista marca todo como nullable; estas columnas nunca lo son. */
export type Achievement = Omit<AchievementRow, 'user_id' | 'appid' | 'apiname' | 'achieved' | 'hidden'> & {
    appid: number
    apiname: string
    achieved: boolean
    hidden: boolean
}

export const ACHIEVEMENT_COLUMNS = 'appid, apiname, achieved, unlocktime, display_name, description, icon, icongray, hidden, global_percent'

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
    /** Cuántos de los que faltan son de rareza rara o más (menos del 15 %). */
    hard: number
}

/**
 * Dificultad estimada de lo que te queda. El 100 % depende sobre todo del logro más raro que falta, así que su
 * rareza marca el nivel (común → fácil … legendaria → muy difícil); si además faltan muchos raros, sube un escalón.
 * null si no falta ninguno.
 */
export function estimateDifficulty(list: Pick<Achievement, 'achieved' | 'global_percent'>[]): DifficultyEstimate | null {
    const locked = list.filter((a) => !a.achieved)
    if (locked.length === 0) return null
    const percents = locked.map((a) => a.global_percent).filter((p): p is number => p !== null)
    const rarest = percents.length > 0 ? Math.min(...percents) : null
    const hard = percents.filter((p) => p < 15).length
    const levels: Difficulty[] = ['facil', 'asequible', 'exigente', 'dificil', 'muy_dificil']
    let index = rarest === null ? 1 : RARITY_TIERS.indexOf(rarityTier(rarest)!)
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

// ── Puntuación de cazador e hitos (#27) ──

/**
 * Puntos de un logro según su rareza, en escala logarítmica: 10 × log10(100 / %), redondeado y como mínimo 1.
 * Un logro del 50 % vale 3; del 10 %, 10; del 1 %, 20; del 0,1 %, 30. Sin % global, 1.
 */
export function achievementPoints(percent: number | null): number {
    if (percent === null) return 1
    const p = Math.min(Math.max(percent, 0.1), 100)
    return Math.max(1, Math.round(10 * Math.log10(100 / p)))
}

/** Puntos ganados (desbloqueados) y posibles (todos) de una lista de logros. */
export function pointsOf(list: Pick<Achievement, 'achieved' | 'global_percent'>[]): { earned: number; possible: number } {
    let earned = 0
    let possible = 0
    for (const a of list) {
        const pts = achievementPoints(a.global_percent)
        possible += pts
        if (a.achieved) earned += pts
    }
    return { earned, possible }
}

/** Puntos de los logros desbloqueados, en total y por juego (de más a menos). */
export function pointsByGame(unlocked: Pick<Achievement, 'appid' | 'achieved' | 'global_percent'>[]): {
    total: number
    games: { appid: number; points: number }[]
} {
    const byGame = new Map<number, number>()
    let total = 0
    for (const a of unlocked) {
        if (!a.achieved) continue
        const pts = achievementPoints(a.global_percent)
        total += pts
        byGame.set(a.appid, (byGame.get(a.appid) ?? 0) + pts)
    }
    const games = [...byGame].map(([appid, points]) => ({ appid, points })).sort((a, b) => b.points - a.points || a.appid - b.appid)
    return { total, games }
}

export interface Milestone {
    id: string
    label: string
    /** ISO del momento en que se alcanzó; null si aún no. */
    date: string | null
    /** Para los pendientes con progreso medible. */
    current?: number
    target?: number
}

export const COUNT_MILESTONES = [100, 500, 1000, 2500, 5000, 10000]
export const PERFECT_MILESTONES = [1, 10, 25, 50, 100]
const RARE_MILESTONES: { id: string; label: string; below: number; tier: 'epica' | 'leg' }[] = [
    { id: 'primer-epico', label: 'Primer logro épico', below: 5, tier: 'epica' },
    { id: 'primer-legendario', label: 'Primer logro legendario', below: 1, tier: 'leg' },
]

function perfectLabel(n: number): string {
    return n === 1 ? 'Primer juego al 100 %' : `${n} juegos al 100 %`
}

/** Un escalón de una serie de hitos: alcanzado (con fecha, si se sabe) o futuro. */
export interface MilestoneStep {
    id: string
    value: number
    label: string
    reached: boolean
    /** ISO del momento en que se alcanzó; null si aún no (o si Steam no da la fecha). */
    date: string | null
}

/** Serie de hitos con todos sus escalones (los alcanzados y los futuros) y por dónde vas. */
export interface MilestoneSeries {
    current: number
    steps: MilestoneStep[]
}

export interface RareMilestone {
    id: string
    label: string
    tier: 'epica' | 'leg'
    reached: boolean
    date: string | null
}

export interface Milestones {
    /** Alcanzados, el más reciente primero. */
    reached: Milestone[]
    /** El siguiente de cada serie. */
    next: Milestone[]
    /** Las tres series completas, para pintarlas como caminos: logros, juegos al 100 % y rarezas. */
    series: { count: MilestoneSeries; perfect: MilestoneSeries; rare: RareMilestone[] }
}

/**
 * Hitos calculados hacia atrás con las fechas de desbloqueo: número de logros, juegos al 100 % y primeros logros
 * épicos (< 5 %) y legendarios (< 1 %). Un juego cuenta como 100 % desde su último desbloqueo. Devuelve los alcanzados
 * (el más reciente primero), el siguiente de cada serie y las series enteras con los escalones futuros.
 */
export function computeMilestones(
    unlocked: Pick<Achievement, 'appid' | 'achieved' | 'unlocktime' | 'global_percent'>[],
    games: Pick<LibraryGame, 'appid' | 'achievements_total' | 'achievements_unlocked'>[],
): Milestones {
    const time = (iso: string | null) => (iso ? Date.parse(iso) : 0)
    const list = unlocked.filter((a) => a.achieved).sort((a, b) => time(a.unlocktime) - time(b.unlocktime))
    const reached: Milestone[] = []
    const next: Milestone[] = []

    const countSteps: MilestoneStep[] = COUNT_MILESTONES.map((n) => {
        const ok = n <= list.length
        return { id: `logros-${n}`, value: n, label: `${n.toLocaleString('es-ES')} logros`, reached: ok, date: ok ? list[n - 1].unlocktime : null }
    })
    for (const s of countSteps) if (s.reached) reached.push({ id: s.id, label: s.label, date: s.date })
    const nextCount = countSteps.find((s) => !s.reached)
    if (nextCount) next.push({ id: nextCount.id, label: nextCount.label, date: null, current: list.length, target: nextCount.value })

    const lastUnlock = new Map<number, string | null>()
    for (const a of list) lastUnlock.set(a.appid, a.unlocktime)
    const perfectDates = games
        .filter((g) => (g.achievements_total ?? 0) > 0 && (g.achievements_unlocked ?? 0) >= (g.achievements_total ?? 0) && lastUnlock.has(g.appid))
        .map((g) => lastUnlock.get(g.appid) ?? null)
        .sort((a, b) => time(a) - time(b))
    const perfectSteps: MilestoneStep[] = PERFECT_MILESTONES.map((n) => {
        const ok = n <= perfectDates.length
        return { id: `perfectos-${n}`, value: n, label: perfectLabel(n), reached: ok, date: ok ? perfectDates[n - 1] : null }
    })
    for (const s of perfectSteps) if (s.reached) reached.push({ id: s.id, label: s.label, date: s.date })
    const nextPerfect = perfectSteps.find((s) => !s.reached)
    if (nextPerfect) next.push({ id: nextPerfect.id, label: nextPerfect.label, date: null, current: perfectDates.length, target: nextPerfect.value })

    const rare: RareMilestone[] = RARE_MILESTONES.map((m) => {
        const first = list.find((a) => a.global_percent !== null && a.global_percent < m.below)
        if (first) reached.push({ id: m.id, label: m.label, date: first.unlocktime })
        else next.push({ id: m.id, label: m.label, date: null })
        return { id: m.id, label: m.label, tier: m.tier, reached: !!first, date: first?.unlocktime ?? null }
    })

    reached.sort((a, b) => time(b.date) - time(a.date))
    return {
        reached,
        next,
        series: { count: { current: list.length, steps: countSteps }, perfect: { current: perfectDates.length, steps: perfectSteps }, rare },
    }
}

/**
 * Hasta dónde llega la línea de una serie de hitos (0–1), con los escalones repartidos a la misma distancia: 0 en el
 * primero, 1 en el último y, entre dos, la parte proporcional de lo que llevas. Sin el primero, 0.
 */
export function seriesProgress(current: number, values: number[]): number {
    const n = values.length
    if (n < 2) return current >= (values[0] ?? Infinity) ? 1 : 0
    const lit = values.filter((v) => v <= current).length
    if (lit === 0) return 0
    if (lit >= n) return 1
    const prev = values[lit - 1]
    const part = (current - prev) / (values[lit] - prev)
    return (lit - 1 + part) / (n - 1)
}

/** Tus logros desbloqueados por rareza (de común a legendaria, todas): cuántos y cuántos puntos dan. */
export function unlockedByRarity(
    unlocked: Pick<Achievement, 'achieved' | 'global_percent'>[],
): { tier: RarityTier; count: number; points: number }[] {
    const out = RARITY_TIERS.map((tier) => ({ tier, count: 0, points: 0 }))
    for (const a of unlocked) {
        const tier = a.achieved ? rarityTier(a.global_percent) : null
        if (!tier) continue
        const row = out[RARITY_TIERS.indexOf(tier)]
        row.count++
        row.points += achievementPoints(a.global_percent)
    }
    return out
}

/** Logros y puntos desbloqueados desde el día 1 del mes de `now` (hora local). */
export function thisMonth(
    unlocked: Pick<Achievement, 'achieved' | 'unlocktime' | 'global_percent'>[],
    now: Date = new Date(),
): { achievements: number; points: number } {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    let achievements = 0
    let points = 0
    for (const a of unlocked) {
        if (!a.achieved || !a.unlocktime || Date.parse(a.unlocktime) < start) continue
        achievements++
        points += achievementPoints(a.global_percent)
    }
    return { achievements, points }
}

/** Cuántos logros de cada juego hay en una lista (por ejemplo, los fáciles que te faltan). */
export function countByGame(list: Pick<Achievement, 'appid'>[]): Map<number, number> {
    const out = new Map<number, number>()
    for (const a of list) out.set(a.appid, (out.get(a.appid) ?? 0) + 1)
    return out
}

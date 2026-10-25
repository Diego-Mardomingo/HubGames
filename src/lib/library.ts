// Biblioteca (#21): filtros y ordenaciones de /biblioteca. Sin acceso a la base de datos, con tests en library.test.ts.
import type { GameStatus, LibraryGame } from './tracker'
import { parseGenres } from './steam-text'

export type LibraryTab = 'todos' | Exclude<GameStatus, 'bandeja'>

export const LIBRARY_TABS: LibraryTab[] = ['todos', 'jugando', 'pendiente', 'pausado', 'completado', 'abandonado', 'descartado']

export type SortKey = 'manual' | 'nombre' | 'horas' | 'reciente' | 'nota' | 'logros' | 'completado' | 'cambio' | 'duracion'

export const SORT_LABELS: Record<SortKey, string> = {
    manual: 'Mi orden',
    nombre: 'Nombre',
    horas: 'Más horas',
    reciente: 'Jugado recientemente',
    nota: 'Mejor nota',
    logros: '% de logros',
    completado: 'Completado recientemente',
    cambio: 'Último cambio de estado',
    duracion: 'Más cortos primero',
}

/** Ordenaciones que tienen sentido en cada pestaña; la primera es la de por defecto. */
export function sortsFor(tab: LibraryTab): SortKey[] {
    switch (tab) {
        case 'pendiente':
            return ['manual', 'duracion', 'nombre', 'horas', 'cambio']
        case 'jugando':
            return ['reciente', 'horas', 'logros', 'nombre', 'cambio']
        case 'completado':
            return ['completado', 'nota', 'horas', 'logros', 'nombre']
        default:
            return ['nombre', 'horas', 'reciente', 'nota', 'logros', 'cambio', 'duracion']
    }
}

export type AchievementFilter = 'todos' | 'sin_logros' | 'empezados' | 'casi' | 'perfectos'
export type DurationFilter = 'todas' | 'corto' | 'medio' | 'largo' | 'muy_largo' | 'sin_dato'
export type ReplayableFilter = 'todos' | 'rejugables' | 'con_final'

export const ACHIEVEMENT_FILTER_LABELS: Record<AchievementFilter, string> = {
    todos: 'Cualquier % de logros',
    sin_logros: 'Sin logros desbloqueados',
    empezados: 'Con algún logro',
    casi: 'Del 75 % al 99 %',
    perfectos: '100 %',
}

export const DURATION_FILTER_LABELS: Record<DurationFilter, string> = {
    todas: 'Cualquier duración',
    corto: 'Menos de 5 h',
    medio: 'De 5 a 15 h',
    largo: 'De 15 a 40 h',
    muy_largo: 'Más de 40 h',
    sin_dato: 'Sin duración',
}

export const REPLAYABLE_FILTER_LABELS: Record<ReplayableFilter, string> = {
    todos: 'Rejugables y con final',
    rejugables: 'Solo rejugables',
    con_final: 'Solo con final',
}

export interface LibraryFilters {
    genre: string | null
    completedYear: number | null
    /** Nota mínima (0 a 10). */
    minRating: number | null
    achievements: AchievementFilter
    duration: DurationFilter
    /** Objetivo "rejugable" (sin final) o el resto. */
    replayable: ReplayableFilter
}

export const NO_FILTERS: LibraryFilters = {
    genre: null,
    completedYear: null,
    minRating: null,
    achievements: 'todos',
    duration: 'todas',
    replayable: 'todos',
}

export function hasFilters(f: LibraryFilters): boolean {
    return f.genre !== null || f.completedYear !== null || f.minRating !== null || f.achievements !== 'todos' || f.duration !== 'todas' || f.replayable !== 'todos'
}

/** Nombres de género de la ficha de Steam (`[{ id, description }]`). */
export function genreNames(game: Pick<LibraryGame, 'genres'>): string[] {
    return parseGenres(game.genres)
}

/** % de logros desbloqueados, o null si el juego no tiene logros. */
export function achievementPercent(game: Pick<LibraryGame, 'achievements_total' | 'achievements_unlocked'>): number | null {
    if (!game.achievements_total) return null
    return Math.floor(((game.achievements_unlocked ?? 0) / game.achievements_total) * 100)
}

/** Duraciones de un juego en minutos (#23): HowLongToBeat; si no lo tiene, la mediana de SteamSpy como historia. */
export interface GameDuration {
    main: number | null
    mainExtra: number | null
    completionist: number | null
    source: 'hltb' | 'steamspy' | null
}

type DurationColumns = 'hltb_main' | 'hltb_main_extra' | 'hltb_completionist' | 'steamspy_median_forever'

export function gameDuration(game: Pick<LibraryGame, DurationColumns>): GameDuration {
    const positive = (n: number | null) => (n && n > 0 ? n : null)
    const hltb = { mainExtra: positive(game.hltb_main_extra), completionist: positive(game.hltb_completionist) }
    if (positive(game.hltb_main)) return { main: game.hltb_main, ...hltb, source: 'hltb' }
    const spy = positive(game.steamspy_median_forever)
    if (spy) return { main: spy, ...hltb, source: 'steamspy' }
    return { main: null, ...hltb, source: hltb.mainExtra || hltb.completionist ? 'hltb' : null }
}

/** Duración estimada de la historia en minutos, para filtrar y ordenar la biblioteca. */
export function estimatedMinutes(game: Pick<LibraryGame, DurationColumns>): number | null {
    return gameDuration(game).main
}

export const DURATION_SOURCE_LABEL: Record<NonNullable<GameDuration['source']>, string> = {
    hltb: 'HowLongToBeat',
    steamspy: 'mediana de SteamSpy',
}

function durationBucket(minutes: number | null): DurationFilter {
    if (minutes === null) return 'sin_dato'
    const hours = minutes / 60
    if (hours < 5) return 'corto'
    if (hours < 15) return 'medio'
    if (hours < 40) return 'largo'
    return 'muy_largo'
}

export function completedYear(game: Pick<LibraryGame, 'completed_at'>): number | null {
    return game.completed_at ? new Date(game.completed_at).getFullYear() : null
}

export function inTab(game: Pick<LibraryGame, 'status'>, tab: LibraryTab): boolean {
    return tab === 'todos' ? game.status !== 'bandeja' : game.status === tab
}

export function matchesFilters(game: LibraryGame, f: LibraryFilters): boolean {
    if (f.genre !== null && !genreNames(game).includes(f.genre)) return false
    if (f.completedYear !== null && completedYear(game) !== f.completedYear) return false
    if (f.minRating !== null && (game.rating === null || game.rating < f.minRating)) return false
    if (f.achievements !== 'todos') {
        const pct = achievementPercent(game)
        if (pct === null) return false
        if (f.achievements === 'sin_logros' && pct !== 0) return false
        if (f.achievements === 'empezados' && pct === 0) return false
        if (f.achievements === 'casi' && (pct < 75 || pct >= 100)) return false
        if (f.achievements === 'perfectos' && pct < 100) return false
    }
    if (f.duration !== 'todas' && durationBucket(estimatedMinutes(game)) !== f.duration) return false
    if (f.replayable !== 'todos' && (game.goal === 'rejugable') !== (f.replayable === 'rejugables')) return false
    return true
}

const byName = (a: LibraryGame, b: LibraryGame) => (a.name ?? '').localeCompare(b.name ?? '', 'es')

/** Fechas ISO de más reciente a más antigua; los null al final. */
function byDateDesc(a: string | null, b: string | null): number {
    return (b ? Date.parse(b) : -Infinity) - (a ? Date.parse(a) : -Infinity) || 0
}

/** Números de mayor a menor (o de menor a mayor con `asc`); los null siempre al final. */
function byNumber(a: number | null, b: number | null, asc = false): number {
    if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1
    return asc ? a - b : b - a
}

export function sortGames(games: LibraryGame[], key: SortKey): LibraryGame[] {
    const cmp: Record<SortKey, (a: LibraryGame, b: LibraryGame) => number> = {
        // Sin posición (recién pasados a Pendiente) van al final, por orden de llegada.
        manual: (a, b) => byNumber(a.backlog_position, b.backlog_position, true) || byDateDesc(b.status_changed_at, a.status_changed_at),
        nombre: () => 0,
        horas: (a, b) => b.playtime_forever - a.playtime_forever,
        reciente: (a, b) => byDateDesc(a.rtime_last_played, b.rtime_last_played),
        nota: (a, b) => byNumber(a.rating, b.rating),
        logros: (a, b) => byNumber(achievementPercent(a), achievementPercent(b)),
        completado: (a, b) => byDateDesc(a.completed_at, b.completed_at),
        cambio: (a, b) => byDateDesc(a.status_changed_at, b.status_changed_at),
        duracion: (a, b) => byNumber(estimatedMinutes(a), estimatedMinutes(b), true),
    }
    return [...games].sort((a, b) => cmp[key](a, b) || byName(a, b))
}

/** Valores presentes en la biblioteca, para rellenar los desplegables de filtros. */
export function filterOptions(games: LibraryGame[]): { genres: string[]; years: number[] } {
    const genres = new Set<string>()
    const years = new Set<number>()
    for (const g of games) {
        for (const name of genreNames(g)) genres.add(name)
        const year = completedYear(g)
        if (year !== null) years.add(year)
    }
    return {
        genres: [...genres].sort((a, b) => a.localeCompare(b, 'es')),
        years: [...years].sort((a, b) => b - a),
    }
}

/** Mueve `appid` a la posición de `overAppid` dentro del orden completo de pendientes. */
export function moveInOrder(order: number[], appid: number, overAppid: number): number[] {
    const from = order.indexOf(appid)
    const to = order.indexOf(overAppid)
    if (from === -1 || to === -1 || from === to) return order
    const next = [...order]
    next.splice(from, 1)
    next.splice(to, 0, appid)
    return next
}

/** Portada vertical de la biblioteca de Steam (600×900). Algunos juegos no la tienen: usar header_image de respaldo. */
export function verticalCover(appid: number): string {
    return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900.jpg`
}

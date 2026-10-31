// Biblioteca (#21): filtros y ordenaciones de /biblioteca. Sin acceso a la base de datos, con tests en library.test.ts.
import type { GameStatus, LibraryGame } from './tracker'
import { parseGenres } from './steam-text'

/** Listas de la biblioteca: todos los clasificados, cada estado y las dos marcas (favorito y sin final). */
export type LibraryTab = 'todos' | GameStatus | 'favorito' | 'sin_final'

export const LIBRARY_TABS: LibraryTab[] = [
    'todos',
    'jugando',
    'pendiente',
    'pausado',
    'rejugable',
    'completado',
    'abandonado',
    'ya_jugado',
    'descartado',
    'otros',
    'favorito',
    'sin_final',
    'bandeja',
]

export type SortKey = 'manual' | 'nombre' | 'horas' | 'reciente' | 'nota' | 'logros' | 'completado' | 'cambio' | 'duracion' | 'descuento'

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
    descuento: 'Mayor descuento',
}

/** Ordenaciones que tienen sentido en cada pestaña; la primera es la de por defecto. */
export function sortsFor(tab: LibraryTab): SortKey[] {
    switch (tab) {
        case 'pendiente':
            return ['manual', 'duracion', 'descuento', 'nombre', 'horas', 'cambio']
        case 'jugando':
            return ['reciente', 'horas', 'logros', 'nombre', 'cambio']
        case 'rejugable':
            // Sin final ni nota (se pone al completar): lo que importa es a cuál has vuelto hace poco y cuánto lo juegas.
            return ['reciente', 'horas', 'nombre', 'logros', 'cambio']
        case 'completado':
            return ['completado', 'nota', 'horas', 'logros', 'nombre']
        default:
            return ['nombre', 'horas', 'reciente', 'nota', 'logros', 'cambio', 'duracion']
    }
}

export type AchievementFilter = 'todos' | 'sin_logros' | 'empezados' | 'casi' | 'perfectos'
export type DurationFilter = 'todas' | 'corto' | 'medio' | 'largo' | 'muy_largo' | 'sin_dato'
export type MarkFilter = 'todas' | 'favoritos' | 'sin_final' | 'con_final'
export type OwnFilter = 'todos' | 'comprados' | 'grupo' | 'sin_comprar'

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

export const MARK_FILTER_LABELS: Record<MarkFilter, string> = {
    todas: 'Cualquier marca',
    favoritos: 'Solo favoritos',
    sin_final: 'Solo sin final',
    con_final: 'Solo con final',
}

export const OWN_FILTER_LABELS: Record<OwnFilter, string> = {
    todos: 'Todos',
    comprados: 'Comprados',
    grupo: 'Del grupo',
    sin_comprar: 'Sin comprar',
}

export interface LibraryFilters {
    genre: string | null
    completedYear: number | null
    /** Nota mínima (0 a 10). */
    minRating: number | null
    achievements: AchievementFilter
    duration: DurationFilter
    /** Favoritos, sin final o con final. */
    marks: MarkFilter
    /** Comprados (en tu biblioteca de Steam) o pendientes sin comprar. */
    own: OwnFilter
}

export const NO_FILTERS: LibraryFilters = {
    genre: null,
    completedYear: null,
    minRating: null,
    achievements: 'todos',
    duration: 'todas',
    marks: 'todas',
    own: 'todos',
}

export function hasFilters(f: LibraryFilters): boolean {
    return (
        f.genre !== null ||
        f.completedYear !== null ||
        f.minRating !== null ||
        f.achievements !== 'todos' ||
        f.duration !== 'todas' ||
        f.marks !== 'todas' ||
        f.own !== 'todos'
    )
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

/** Estados que no salen en "Todos" (además de la bandeja). */
const OUT_OF_ALL: GameStatus[] = ['descartado', 'otros']

export function inTab(game: Pick<LibraryGame, 'status' | 'favorite' | 'endless'>, tab: LibraryTab): boolean {
    // Los descartados y "Otros" (software, demos, bandas sonoras...) tienen su propia lista: en "Todos" solo estorban.
    if (tab === 'todos') return game.status !== 'bandeja' && !OUT_OF_ALL.includes(game.status)
    if (tab === 'favorito') return game.favorite
    if (tab === 'sin_final') return game.endless
    return game.status === tab
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
    if (f.marks === 'favoritos' && !game.favorite) return false
    if (f.marks === 'sin_final' && !game.endless) return false
    if (f.marks === 'con_final' && game.endless) return false
    if (f.own !== 'todos' && ownership(game) !== f.own) return false
    return true
}

/** De quién es: tuyo, prestado ahora por el grupo familiar de Steam (#86) o sin comprar (incluye los que salieron del grupo). */
export function ownership(game: Pick<LibraryGame, 'owned' | 'steam_source'>): Exclude<OwnFilter, 'todos'> {
    if (!game.owned) return 'sin_comprar'
    return game.steam_source === 'family' ? 'grupo' : 'comprados'
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
        // Solo tienen descuento los que no tienes; los comprados van detrás.
        descuento: (a, b) => byNumber(a.owned ? null : (a.discount_percent ?? 0), b.owned ? null : (b.discount_percent ?? 0)),
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

/** Lista de inicio (📌): la que abre /biblioteca, con su orden, filtros y vista. Se guarda en hubgames_usuarios.library_home. */
export type LibraryView = 'lista' | 'cuadricula'

export interface LibraryHome {
    tab: LibraryTab
    sort: SortKey
    filters: LibraryFilters
    view: LibraryView
}

export const DEFAULT_HOME: LibraryHome = { tab: 'todos', sort: sortsFor('todos')[0], filters: NO_FILTERS, view: 'lista' }

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
    return allowed.includes(value as T) ? (value as T) : fallback
}

const nullableNumber = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Lee la lista de inicio guardada (JSON de la base de datos). Lo que no se reconozca vuelve al valor por defecto. */
export function parseLibraryHome(raw: unknown): LibraryHome | null {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    const tab = pick(r.tab, LIBRARY_TABS, 'todos')
    const f = (r.filters && typeof r.filters === 'object' ? r.filters : {}) as Record<string, unknown>
    return {
        tab,
        sort: pick(r.sort, sortsFor(tab), sortsFor(tab)[0]),
        view: pick(r.view, ['lista', 'cuadricula'] as const, 'lista'),
        filters: {
            genre: typeof f.genre === 'string' ? f.genre : null,
            completedYear: nullableNumber(f.completedYear),
            minRating: nullableNumber(f.minRating),
            achievements: pick(f.achievements, Object.keys(ACHIEVEMENT_FILTER_LABELS) as AchievementFilter[], 'todos'),
            duration: pick(f.duration, Object.keys(DURATION_FILTER_LABELS) as DurationFilter[], 'todas'),
            marks: pick(f.marks, Object.keys(MARK_FILTER_LABELS) as MarkFilter[], 'todas'),
            own: pick(f.own, Object.keys(OWN_FILTER_LABELS) as OwnFilter[], 'todos'),
        },
    }
}

export function sameHome(a: LibraryHome, b: LibraryHome): boolean {
    return a.tab === b.tab && a.sort === b.sort && a.view === b.view && JSON.stringify(a.filters) === JSON.stringify(b.filters)
}

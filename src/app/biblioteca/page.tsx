'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    rectSortingStrategy,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
    AlertTriangle,
    ArrowRight,
    Check,
    Clock,
    FilterX,
    GripVertical,
    Heart,
    Hourglass,
    Inbox,
    LayoutGrid,
    Library,
    List,
    Minus,
    Pin,
    Plus,
    Search,
    ShoppingCart,
    Star,
    Undo2,
    Users,
    X,
} from 'lucide-react'
import { safeGetSession, supabase } from '@/lib/supabase/client'
import { loadSteamLinked } from '@/lib/steam-link'
import { libraryEmpty, type LibraryEmpty } from '@/lib/empty-states'
import EmptyState from '@/components/EmptyState'
import SteamEmpty from '@/components/SteamEmpty'
import {
    DEFAULT_PLAYING_LIMIT,
    completeGames,
    formatHours,
    getLibraryHome,
    getPlayingLimit,
    loadLibrary,
    reorderBacklog,
    restoreGames,
    setGameMark,
    setGamesStatus,
    setLibraryHome,
    setPlayingLimit,
    statusSnapshot,
    suggestedCompletionDate,
    type GameMark,
    type GameStatus,
    type LibraryGame,
    type StatusSnapshot,
} from '@/lib/tracker'
import { rowChange, statusPatch } from '@/lib/library-motion'
import {
    ACHIEVEMENT_FILTER_LABELS,
    DURATION_FILTER_LABELS,
    LIBRARY_TABS,
    MARK_FILTER_LABELS,
    NO_FILTERS,
    OWN_FILTER_LABELS,
    SORT_LABELS,
    achievementPercent,
    estimatedMinutes,
    filterOptions,
    hasFilters,
    inTab,
    matchesFilters,
    moveInOrder,
    sameHome,
    sortGames,
    sortsFor,
    type AchievementFilter,
    type DurationFilter,
    type LibraryFilters,
    type LibraryHome,
    type LibraryTab,
    type LibraryView,
    type MarkFilter,
    type OwnFilter,
    type SortKey,
} from '@/lib/library'
import { metacriticScore, ratingTier } from '@/lib/scores'
import { isPerfect } from '@/lib/tracker-rules'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import SkeletonSwap from '@/components/SkeletonSwap'
import { Skeleton, SkeletonZone } from '@/components/ui/skeleton'
import { RowSkeleton } from '@/components/skeletons'
import KeyboardList from '@/components/KeyboardList'
import GameCover from '@/components/tracker/GameCover'
import GameMenu, { type GameMenuAct } from '@/components/tracker/GameMenu'
import AnimatedCount from '@/components/AnimatedCount'
import Segmented from '@/components/Segmented'
import { TrayFly, type TrayFlight } from './bandeja/TrayParts'
import { openGameSearch } from '@/components/tracker/GameSearch'
import SearchShortcut from '@/components/tracker/SearchShortcut'
import { LIST_ICONS, MarkFlags, StatusChip, listClass } from '@/components/tracker/status'
import { PriceTag } from '@/components/wishlist/PriceInfo'
import '@/components/wishlist/wishlist.css'
import './biblioteca.css'

const PAGE = 60
const VIEW_KEY = 'hubgames:biblioteca-vista'
const ALL = 'all'
/** Tinte de la fila antes de salir, aviso de Deshacer, vuelo al raíl y lo que dura la salida (deslizar + plegar). */
const TINT_MS = 200
const TOAST_MS = 5000
const FLY_MS = 440
const LEAVE_MS = { lista: 460, cuadricula: 200 } as const
const EASE_OUT = [0.22, 1, 0.36, 1] as const

/** Donde se escribe o hay un diálogo abierto, Ctrl + Z es de ese sitio. */
function ownsKeys(el: Element | null): boolean {
    return !!el?.closest('input:not([type="checkbox"]), textarea, select, [contenteditable="true"], [role="dialog"]')
}

type Mark = GameMark

/** Lo que acaba de cambiar en una fila: su chip, una marca que se enciende o se quita, o que vuelve (Deshacer o error). */
interface Fresh {
    status?: boolean
    lit?: Mark
    leaving?: Mark
    back?: boolean
}

/** Fila que ya no está en la lista pero se sigue pintando mientras sale y se pliega (o se funde, en la rejilla). */
interface Ghost {
    key: number
    game: LibraryGame
    /** Fila tras la que iba (null = la primera). */
    anchor: number | null
    height: number
}

/** Un cambio guardado al momento: lo necesario para deshacerlo o devolverlo si falla. */
interface LibAction {
    id: number
    game: LibraryGame
    snapshot: StatusSnapshot
    write: Promise<void>
    undone: boolean
}

interface LibToastData {
    id: number
    name: string
    status: GameStatus | null
    /** Sin estado: la marca que se ha quitado y ha sacado al juego de su lista. */
    left: 'favorito' | 'sin_final' | null
}

const MARK_LIST: Record<Mark, 'favorito' | 'sin_final'> = { favorite: 'favorito', endless: 'sin_final' }

const TAB_LABELS: Record<LibraryTab, string> = {
    todos: 'Todos',
    jugando: 'Jugando',
    pendiente: 'Pendientes',
    pausado: 'Pausados',
    rejugable: 'Rejugables',
    completado: 'Completados',
    abandonado: 'Abandonados',
    ya_jugado: 'Ya jugados',
    descartado: 'Descartados',
    otros: 'Otros',
    favorito: 'Favoritos',
    sin_final: 'Sin final',
    bandeja: 'Bandeja',
}

const TAB_HINTS: Record<LibraryTab, string> = {
    todos: 'Todos tus juegos clasificados, menos los descartados y los de «Otros»',
    jugando: 'Lo que juegas ahora',
    pendiente: 'Para jugar más adelante, comprados o no',
    pausado: 'En pausa por un tiempo',
    rejugable: 'Juegos vivos a los que vuelves de vez en cuando a echar una partida, sin un final que perseguir',
    completado: 'Terminados',
    abandonado: 'Empezados y dejados',
    ya_jugado: 'Jugados antes o sin seguimiento: ni completados ni abandonados',
    descartado: 'Los tienes, pero no te interesan',
    otros: 'Lo que no encaja en ninguna lista: software, demos, betas, bandas sonoras...',
    favorito: 'Tus favoritos, estén en la lista que estén',
    sin_final: 'Juegos que no se terminan: se juegan. Estén en la lista que estén',
    bandeja: 'Sin clasificar: decide a qué lista va cada uno',
}

/** Grupos del raíl de listas. La bandeja va aparte, al final. */
const RAIL: { title: string | null; tabs: LibraryTab[] }[] = [
    { title: null, tabs: ['todos'] },
    { title: 'Estados', tabs: ['jugando', 'pendiente', 'pausado', 'rejugable', 'completado', 'abandonado', 'ya_jugado', 'descartado', 'otros'] },
    { title: 'Marcas', tabs: ['favorito', 'sin_final'] },
]

const VIEWS: readonly LibraryView[] = ['lista', 'cuadricula']
const VIEW_LABELS: Record<LibraryView, string> = { lista: 'Lista', cuadricula: 'Rejilla' }
const VIEW_ICONS: Record<LibraryView, ReactNode> = { lista: <List aria-hidden />, cuadricula: <LayoutGrid aria-hidden /> }
const OWN_FILTERS = Object.keys(OWN_FILTER_LABELS) as OwnFilter[]
const OWN_ICONS: Partial<Record<OwnFilter, ReactNode>> = { comprados: <Check aria-hidden />, grupo: <Users aria-hidden />, sin_comprar: <ShoppingCart aria-hidden /> }

function parseTab(value: string | null): LibraryTab | null {
    return LIBRARY_TABS.includes(value as LibraryTab) ? (value as LibraryTab) : null
}

function TabIcon({ tab }: { tab: LibraryTab }) {
    const Icon = tab === 'todos' ? Library : LIST_ICONS[tab]
    return (
        <span className={`lib-rail__icon hg-tint ${listClass(tab)}`}>
            <Icon aria-hidden />
        </span>
    )
}

/**
 * Esqueleto de la biblioteca: cabecera, raíl con sus listas (fijas: solo faltan los contadores), cabecera de la lista
 * (de verdad si viene en la URL), filtros y filas. Lo usan el `Suspense` de `useSearchParams` y la carga de datos.
 */
function LibrarySkeleton({ tab }: { tab?: LibraryTab | null }) {
    const HeadIcon = tab ? (tab === 'todos' ? Library : LIST_ICONS[tab]) : null
    return (
        <SkeletonZone label="Cargando la biblioteca">
            <div className="biblioteca">
                <header className="page-head">
                    <div>
                        <h1 className="page-title">Biblioteca</h1>
                        <p className="page-subtitle">
                            <Skeleton shape="text" w="34ch" />
                        </p>
                    </div>
                    <div className="lib-head-actions">
                        <Skeleton w={190} h={40} style={{ borderRadius: 'var(--radius-sm)' }} />
                        <Skeleton w={118} h={40} style={{ borderRadius: 'var(--radius-sm)' }} />
                    </div>
                </header>
                <div className="lib-layout">
                    <nav className="lib-rail" aria-hidden>
                        {RAIL.map((group) => (
                            <div key={group.title ?? 'todos'} className="lib-rail__group">
                                {group.title && <p className="lib-rail__title">{group.title}</p>}
                                {group.tabs.map((t) => (
                                    <span key={t} className={`lib-rail__item ${listClass(t)}`}>
                                        <TabIcon tab={t} />
                                        <span className="lib-rail__label">{TAB_LABELS[t]}</span>
                                        <span className="lib-rail__count">
                                            <Skeleton shape="text" w="2ch" />
                                        </span>
                                    </span>
                                ))}
                            </div>
                        ))}
                        <div className="lib-rail__group lib-rail__group--tray">
                            <span className={`lib-rail__item ${listClass('bandeja')} lib-rail__item--tray`}>
                                <TabIcon tab="bandeja" />
                                <span className="lib-rail__label">{TAB_LABELS.bandeja}</span>
                                <span className="lib-rail__count">
                                    <Skeleton shape="text" w="2ch" />
                                </span>
                            </span>
                        </div>
                    </nav>
                    <section className={`lib-main${tab ? ` ${listClass(tab)}` : ''}`}>
                        <div className="lib-listhead">
                            {HeadIcon && tab ? (
                                <span className="lib-listhead__icon hg-tint">
                                    <HeadIcon aria-hidden />
                                </span>
                            ) : (
                                <Skeleton className="lib-listhead__icon" />
                            )}
                            <div className="lib-listhead__text">
                                <h2>{tab ? TAB_LABELS[tab] : <Skeleton shape="text" w="9ch" />}</h2>
                                <p>{tab ? TAB_HINTS[tab] : <Skeleton shape="text" w="30ch" />}</p>
                            </div>
                            <div className="lib-listhead__actions">
                                <Skeleton w={76} h={36} style={{ borderRadius: 'var(--radius-sm)' }} />
                                <Skeleton w={140} h={32} style={{ borderRadius: 'var(--radius-sm)' }} />
                            </div>
                        </div>
                        <div className="lib-filters" aria-hidden>
                            {[150, 150, 150, 150, 150].map((w, i) => (
                                <Skeleton key={i} w={w} h={36} style={{ borderRadius: 'var(--radius-sm)' }} />
                            ))}
                        </div>
                        <ul className="hg-rows lib-list">
                            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                                <RowSkeleton key={i} i={i} className="lib-row" />
                            ))}
                        </ul>
                    </section>
                </div>
            </div>
        </SkeletonZone>
    )
}

export default function BibliotecaPage() {
    return (
        <Suspense fallback={<SkeletonSwap skeleton={<LibrarySkeleton />} />}>
            <Biblioteca />
        </Suspense>
    )
}

function Biblioteca() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const param = parseTab(searchParams.get('estado'))

    const [userId, setUserId] = useState<string | null>(null)
    const [games, setGames] = useState<LibraryGame[] | null>(null)
    // undefined = cargando; null = sin lista de inicio.
    const [home, setHome] = useState<LibraryHome | null | undefined>(undefined)
    const [limit, setLimit] = useState(DEFAULT_PLAYING_LIMIT)
    // Solo se pinta en el cliente (antes sale el esqueleto), así que se puede leer localStorage al iniciar.
    const [view, setView] = useState<LibraryView>(() =>
        typeof window !== 'undefined' && localStorage.getItem(VIEW_KEY) === 'cuadricula' ? 'cuadricula' : 'lista',
    )
    const [appliedTab, setAppliedTab] = useState<LibraryTab | null>(null)
    const [sort, setSort] = useState<SortKey>('nombre')
    const [filters, setFilters] = useState<LibraryFilters>(NO_FILTERS)
    const [visible, setVisible] = useState(PAGE)
    const [error, setError] = useState('')
    const [savingHome, setSavingHome] = useState(false)
    // Solo para el vacío sin juegos: «Conectar con Steam» o «Sincronizar».
    const [steamLinked, setSteamLinked] = useState<boolean | null>(null)
    // Movimiento: filas que salen, tinte antes de salir, lo recién cambiado, contadores que esperan al vuelo, vuelos,
    // aviso de Deshacer, anuncio para lectores de pantalla y tarjetas que se mueven en la rejilla.
    const reduce = useReducedMotion()
    const [ghosts, setGhosts] = useState<Ghost[]>([])
    const [tint, setTint] = useState<Record<number, GameStatus>>({})
    const [fresh, setFresh] = useState<Record<number, Fresh>>({})
    const [held, setHeld] = useState<Partial<Record<LibraryTab, number>>>({})
    const [flights, setFlights] = useState<TrayFlight[]>([])
    const [toast, setToast] = useState<LibToastData | null>(null)
    const [announce, setAnnounce] = useState('')
    const [shift, setShift] = useState<number | null>(null)
    const [focusIndex, setFocusIndex] = useState<number | null>(null)
    // Tras cambiar de lista o de vista, el contenido entra con un fundido (al llegar, viene del esqueleto: sin él).
    const [switched, setSwitched] = useState(false)
    const lastAction = useRef<LibAction | null>(null)
    const seq = useRef(0)
    const railRef = useRef<HTMLElement>(null)

    useEffect(() => {
        safeGetSession().then(({ data: { session } }) => {
            if (!session) {
                router.push('/login')
                return
            }
            setUserId(session.user.id)
            getPlayingLimit(session.user.id).then(setLimit)
            getLibraryHome(session.user.id)
                .then(setHome)
                .catch(() => setHome(null))
            loadLibrary()
                .then(setGames)
                .catch((e: Error) => {
                    setError(e.message)
                    setGames([])
                })
            loadSteamLinked(supabase).then(setSteamLinked)
        })
    }, [router])

    const reload = () => {
        loadLibrary()
            .then(setGames)
            .catch(() => {})
    }

    // La bandeja tiene su propia página (/biblioteca/bandeja): ?estado=bandeja lleva allí.
    useEffect(() => {
        if (param === 'bandeja') router.replace('/biblioteca/bandeja')
    }, [param, router])

    // Sin ?estado= se abre la lista de inicio (📌) o, si no hay, "Todos". La bandeja no puede ser lista de inicio.
    const homeTab = home?.tab === 'bandeja' ? null : home?.tab
    const tab: LibraryTab = (param === 'bandeja' ? null : param) ?? homeTab ?? 'todos'

    // Al cambiar de lista (también con atrás/adelante): la de inicio abre con su orden, filtros y vista; el resto, con
    // su orden por defecto y sin filtros.
    if (home !== undefined && appliedTab !== tab) {
        if (appliedTab !== null) setSwitched(true)
        setAppliedTab(tab)
        setVisible(PAGE)
        if (home && home.tab === tab) {
            setSort(home.sort)
            setFilters(home.filters)
            setView(home.view)
        } else {
            setSort(sortsFor(tab)[0])
            setFilters(NO_FILTERS)
        }
    }

    const counts = useMemo(() => {
        const out = Object.fromEntries(LIBRARY_TABS.map((t) => [t, 0])) as Record<LibraryTab, number>
        let unowned = 0
        for (const g of games ?? []) {
            for (const t of LIBRARY_TABS) if (inTab(g, t)) out[t]++
            if (!g.owned) unowned++
        }
        // "Todos" no enseña los descartados ni "Otros", pero también están clasificados.
        return { ...out, unowned, classified: out.todos + out.descartado + out.otros }
    }, [games])

    const inList = useMemo(() => (games ?? []).filter((g) => inTab(g, tab)), [games, tab])
    const options = useMemo(() => filterOptions(inList), [inList])
    const mixedOwnership = inList.some((g) => !g.owned || g.steam_source === 'family')
    const list = useMemo(() => sortGames(inList.filter((g) => matchesFilters(g, filters)), sort), [inList, filters, sort])
    const shown = list.slice(0, visible)
    const canDrag = tab === 'pendiente' && sort === 'manual' && !hasFilters(filters)
    const showStatus = tab === 'todos' || tab === 'favorito' || tab === 'sin_final'

    const current: LibraryHome = { tab, sort, filters, view }
    const isHomeTab = home?.tab === tab
    const homeChanged = isHomeTab && home ? !sameHome(home, current) : false

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    function changeTab(next: LibraryTab) {
        router.replace(`/biblioteca?estado=${next}`, { scroll: false })
    }

    function changeView(next: LibraryView) {
        if (next !== view) setSwitched(true)
        setView(next)
        localStorage.setItem(VIEW_KEY, next)
    }

    async function saveHome() {
        if (!userId) return
        setSavingHome(true)
        setError('')
        try {
            await setLibraryHome(userId, current)
            setHome(current)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo guardar la lista de inicio')
        } finally {
            setSavingHome(false)
        }
    }

    function patchGame(appid: number, patch: Partial<LibraryGame> | null) {
        setGames((list) =>
            (list ?? []).flatMap((g) => (g.appid !== appid ? [g] : patch === null ? [] : [{ ...g, ...patch }])),
        )
    }

    /** Ids de la lista visible para un conjunto de juegos (la de ahora o la de después de un cambio). */
    function visibleIds(list: LibraryGame[]): number[] {
        return sortGames(
            list.filter((g) => inTab(g, tab) && matchesFilters(g, filters)),
            sort,
        )
            .slice(0, visible)
            .map((g) => g.appid)
    }

    const countIn = (list: LibraryGame[], t: LibraryTab) => list.filter((g) => inTab(g, t)).length

    function markFresh(appid: number, f: Fresh) {
        setFresh((m) => ({ ...m, [appid]: { ...m[appid], ...f } }))
        setTimeout(
            () =>
                setFresh((m) => {
                    const next = { ...m }
                    delete next[appid]
                    return next
                }),
            1300,
        )
    }

    function untint(appid: number) {
        setTint((t) => {
            const rest = { ...t }
            delete rest[appid]
            return rest
        })
    }

    /** Ficha con el icono de la lista que vuela de la fila a su sitio en el raíl. En la tira de móvil, solo si se ve. */
    function launchFlight(row: Element, dest: GameStatus): boolean {
        const rail = railRef.current
        const target = rail?.querySelector(`[data-rail="${dest}"] .lib-rail__count`)
        if (reduce || !rail || !target) return false
        const a = row.getBoundingClientRect()
        const b = target.getBoundingClientRect()
        const r = rail.getBoundingClientRect()
        const seen = b.width > 0 && b.left >= r.left - 1 && b.right <= r.right + 1 && b.top >= 0 && b.bottom <= window.innerHeight
        if (!seen) return false
        const flight: TrayFlight = {
            id: ++seq.current,
            status: dest,
            count: 1,
            from: { x: a.left + 10, y: a.top + a.height / 2 - 14 },
            to: { x: b.left + b.width / 2 - 14, y: b.top + b.height / 2 - 14 },
        }
        setFlights((f) => [...f, flight])
        return true
    }

    const endFlight = useCallback((id: number) => setFlights((f) => f.filter((x) => x.id !== id)), [])

    /**
     * Aplica un cambio con movimiento: si la fila sale de la lista, se tiñe de su destino (al cambiar de estado), sale, se
     * pliega y una ficha vuela al raíl; si cambia de puesto, se pliega en el viejo y vuelve a entrar en el nuevo; si se
     * queda, su chip o su marca reaccionan. `next = null`: el juego sale de la biblioteca (quitar de Pendientes).
     */
    function applyChange(game: LibraryGame, next: LibraryGame | null, opts: { action?: LibAction; dest?: GameStatus; mark?: { mark: Mark; on: boolean } } = {}) {
        if (!games) return
        const all = games
        const appid = game.appid
        const swapIn = (list: LibraryGame[]) => list.flatMap((g) => (g.appid !== appid ? [g] : next ? [next] : []))
        const before = visibleIds(all)
        const change = rowChange(before, visibleIds(swapIn(all)), appid)
        const commit = () => setGames((list) => swapIn(list ?? []))
        const react = () => {
            if (opts.dest) markFresh(appid, { status: true })
            if (opts.mark) markFresh(appid, opts.mark.on ? { lit: opts.mark.mark } : { leaving: opts.mark.mark })
        }
        if (reduce || change.kind === 'stay' || change.kind === 'none') {
            commit()
            if (change.kind === 'leave') setFocusIndex(change.index)
            else if (!reduce) react()
            return
        }
        const rowEl = () => document.querySelector(`.lib-list > li[data-appid="${appid}"]:not(.lib-ghost)`)
        const leaveFrom = (from: number, shown: LibraryGame) => {
            const ghost: Ghost = { key: ++seq.current, game: shown, anchor: from > 0 ? before[from - 1] : null, height: rowEl()?.getBoundingClientRect().height ?? 68 }
            const grid = view === 'cuadricula'
            setGhosts((list) => [...list, ghost])
            setTimeout(() => {
                setGhosts((list) => list.filter((x) => x.key !== ghost.key))
                if (grid) {
                    setShift(from)
                    setTimeout(() => setShift(null), 200)
                }
            }, LEAVE_MS[view])
        }
        if (change.kind === 'move') {
            leaveFrom(change.from, game)
            commit()
            react()
            markFresh(appid, { back: true })
            return
        }
        const dest = opts.dest
        const go = () => {
            untint(appid)
            if (opts.action?.undone) return
            const el = rowEl()
            const active = document.activeElement
            const hadFocus = !active || active === document.body || !!el?.contains(active) || !!active.closest('.game-menu')
            if (dest && el && launchFlight(el, dest)) {
                setHeld({ [dest]: countIn(all, dest) })
                setTimeout(() => setHeld({}), FLY_MS)
            }
            leaveFrom(change.index, next ?? game)
            commit()
            if (hadFocus) setFocusIndex(change.index)
        }
        if (dest) {
            setTint((t) => ({ ...t, [appid]: dest }))
            setTimeout(go, TINT_MS)
        } else go()
    }

    /** Estado o marca desde el menú: se guarda al momento, con «Deshacer» 5 s; si falla, el juego vuelve. */
    function act(game: LibraryGame, a: GameMenuAct) {
        if (!games) return
        const name = game.name ?? `App ${game.appid}`
        const patch: Partial<LibraryGame> =
            a.kind === 'status' ? statusPatch(game, a.status, new Date().toISOString(), suggestedCompletionDate(game)?.date ?? null) : { [a.mark]: a.on }
        const write =
            a.kind === 'status'
                ? a.status === 'completado'
                    ? completeGames([game])
                    : setGamesStatus([game.appid], a.status)
                : setGameMark(game.appid, a.mark, a.on)
        const action: LibAction = { id: ++seq.current, game, snapshot: statusSnapshot(game), write, undone: false }
        const next = { ...game, ...patch }
        lastAction.current = action
        setError('')
        if (a.kind === 'status') {
            setAnnounce(`${name} pasa a ${TAB_LABELS[a.status]}`)
            setToast({ id: action.id, name, status: a.status, left: null })
        } else {
            const list = MARK_LIST[a.mark]
            const leaves = visibleIds(games).includes(game.appid) && !visibleIds(games.map((g) => (g.appid === game.appid ? next : g))).includes(game.appid)
            setAnnounce(`${name}: ${a.on ? 'añadido a' : 'quitado de'} ${TAB_LABELS[list]}`)
            setToast(leaves ? { id: action.id, name, status: null, left: list } : null)
            if (!leaves) lastAction.current = null
        }
        write.catch((e: unknown) => {
            if (action.undone) return
            action.undone = true
            bringBack(action)
            setError(e instanceof Error ? e.message : 'No se pudo guardar')
            if (lastAction.current === action) {
                lastAction.current = null
                setToast(null)
            }
        })
        applyChange(game, next, a.kind === 'status' ? { action, dest: a.status } : { action, mark: { mark: a.mark, on: a.on } })
    }

    /** Devuelve el juego como estaba (Deshacer o error): vuelve a su sitio con el cursor encendido un instante. */
    function bringBack(action: LibAction) {
        const appid = action.game.appid
        untint(appid)
        setGames((list) => (list ?? []).map((g) => (g.appid === appid ? action.game : g)))
        if (!reduce) markFresh(appid, { back: true })
        setAnnounce(`${action.game.name ?? 'El juego'} vuelve a ${TAB_LABELS[action.game.status]}`)
    }

    async function undo() {
        const action = lastAction.current
        if (!action || action.undone) return
        action.undone = true
        lastAction.current = null
        setToast(null)
        bringBack(action)
        try {
            await action.write.catch(() => undefined)
            await restoreGames([action.snapshot])
        } catch (e) {
            setError(`No se pudo deshacer: ${e instanceof Error ? e.message : 'error al guardar'}`)
        }
    }

    // El aviso de Deshacer dura 5 s; al irse, ya no se puede deshacer.
    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => {
            setToast(null)
            if (lastAction.current?.id === toast.id) lastAction.current = null
        }, TOAST_MS)
        return () => clearTimeout(t)
    }, [toast])

    // Ctrl + Z deshace el último cambio (salvo donde se escribe o con un diálogo abierto).
    const undoRef = useRef(undo)
    useEffect(() => {
        undoRef.current = undo
    })
    useEffect(() => {
        function onKey(e: globalThis.KeyboardEvent) {
            if (e.defaultPrevented || ownsKeys(document.activeElement)) return
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z' && lastAction.current) {
                e.preventDefault()
                void undoRef.current()
            }
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [])

    // Si la fila que tenía el foco sale de la lista, el foco pasa a la que ocupa su sitio (o a la última).
    useEffect(() => {
        if (focusIndex === null) return
        const links = document.querySelectorAll<HTMLElement>('.lib-list > li:not(.lib-ghost) [data-row-link]')
        links[Math.min(focusIndex, links.length - 1)]?.focus({ preventScroll: true })
        setFocusIndex(null)
    }, [focusIndex, games])

    // En la tira del raíl (móvil y pantallas estrechas), la lista activa siempre a la vista.
    const ready = games !== null
    useEffect(() => {
        const rail = railRef.current
        if (!rail || rail.scrollWidth <= rail.clientWidth + 1) return
        const item = rail.querySelector<HTMLElement>('[aria-current="page"]')
        if (!item) return
        const left = item.offsetLeft
        const right = left + item.offsetWidth
        if (left < rail.scrollLeft || right > rail.scrollLeft + rail.clientWidth) {
            rail.scrollTo({ left: Math.max(0, left - 24), behavior: reduce ? 'auto' : 'smooth' })
        }
    }, [tab, reduce, ready])

    /** Guarda el orden completo de pendientes; si falla, vuelve al anterior. */
    async function onDragEnd({ active, over }: DragEndEvent) {
        if (!games || !over || active.id === over.id) return
        const order = moveInOrder(list.map((g) => g.appid), Number(active.id), Number(over.id))
        const position = new Map(order.map((appid, i) => [appid, i + 1]))
        const previous = games
        setGames(games.map((g) => (position.has(g.appid) ? { ...g, backlog_position: position.get(g.appid)! } : g)))
        setError('')
        try {
            await reorderBacklog(order)
        } catch (e) {
            setGames(previous)
            setError(e instanceof Error ? e.message : 'No se pudo guardar el orden')
        }
    }

    async function changeLimit(next: number) {
        if (!userId || next < 1 || next > 20) return
        const previous = limit
        setLimit(next)
        try {
            await setPlayingLimit(userId, next)
        } catch (e) {
            setLimit(previous)
            setError(e instanceof Error ? e.message : 'No se pudo guardar el límite')
        }
    }

    const skeleton = <LibrarySkeleton tab={param} />
    if (!games || home === undefined) return <SkeletonSwap skeleton={skeleton} />

    const overLimit = counts.jugando > limit
    const HeadIcon = tab === 'todos' ? Library : LIST_ICONS[tab]

    return (
        <SkeletonSwap skeleton={skeleton}>
            <div className="biblioteca">
                <header className="page-head">
                    <div>
                        <h1 className="page-title">Biblioteca</h1>
                        <p className="page-subtitle">
                            <AnimatedCount value={counts.classified} /> {counts.classified === 1 ? 'juego clasificado' : 'juegos clasificados'}
                            {counts.jugando > 0 && (
                                <>
                                    {' · '}
                                    <AnimatedCount value={counts.jugando} /> en curso
                                </>
                            )}
                            {counts.unowned > 0 && (
                                <>
                                    {' · '}
                                    <AnimatedCount value={counts.unowned} /> {counts.unowned === 1 ? 'pendiente' : 'pendientes'} sin comprar
                                </>
                            )}
                        </p>
                    </div>
                    <div className="lib-head-actions">
                        <Button variant="secondary" onClick={openGameSearch} aria-keyshortcuts="Control+K">
                            <Search aria-hidden /> Buscar juego <SearchShortcut className="hg-kbd lib-kbd" />
                        </Button>
                        <Button variant="secondary" asChild>
                            <Link href="/wishlist">
                                <Heart aria-hidden /> Wishlist
                            </Link>
                        </Button>
                    </div>
                </header>

                {error && (
                    <p className="alert alert--error" role="alert">
                        {error}
                    </p>
                )}

                <div className="lib-layout">
                    <nav className="lib-rail" aria-label="Listas" ref={railRef}>
                        {RAIL.map((group) => (
                            <div key={group.title ?? 'todos'} className="lib-rail__group">
                                {group.title && <p className="lib-rail__title">{group.title}</p>}
                                {group.tabs.map((t) => (
                                    <RailItem
                                        key={t}
                                        tab={t}
                                        count={held[t] ?? counts[t]}
                                        current={tab === t}
                                        pinned={home?.tab === t}
                                        reduce={!!reduce}
                                        onSelect={changeTab}
                                    />
                                ))}
                            </div>
                        ))}
                        <div className="lib-rail__group lib-rail__group--tray">
                            <Link href="/biblioteca/bandeja" className={`lib-rail__item ${listClass('bandeja')} lib-rail__item--tray`} data-rail="bandeja">
                                <TabIcon tab="bandeja" />
                                <span className="lib-rail__label">{TAB_LABELS.bandeja}</span>
                                <AnimatedCount value={held.bandeja ?? counts.bandeja} className="lib-rail__count" />
                            </Link>
                        </div>
                    </nav>

                    <section className={`lib-main ${listClass(tab)}`} aria-labelledby="lib-list-title">
                        <div className="lib-listhead">
                            <span key={tab} className={`lib-listhead__icon hg-tint${switched ? ' is-in' : ''}`}>
                                <HeadIcon aria-hidden />
                            </span>
                            <div key={`t-${tab}`} className={`lib-listhead__text${switched ? ' hg-swap-in' : ''}`}>
                                <h2 id="lib-list-title">{TAB_LABELS[tab]}</h2>
                                <p>{TAB_HINTS[tab]}</p>
                            </div>
                            <div className="lib-listhead__actions">
                                <Segmented
                                    aria-label="Vista"
                                    value={view}
                                    options={VIEWS}
                                    labels={VIEW_LABELS}
                                    icons={VIEW_ICONS}
                                    iconOnly
                                    onChange={changeView}
                                />
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className={`lib-pin${isHomeTab ? ' is-pinned' : ''}`}
                                    onClick={saveHome}
                                    loading={savingHome}
                                    disabled={isHomeTab && !homeChanged}
                                    title="La biblioteca se abrirá en esta lista, con este orden, filtros y vista"
                                >
                                    <Pin aria-hidden />
                                    {isHomeTab ? (homeChanged ? 'Guardar en la de inicio' : 'Lista de inicio') : 'Fijar como inicio'}
                                </Button>
                            </div>
                        </div>

                        {tab === 'jugando' && (
                            <div className={`lib-limit ${overLimit ? 'is-over' : ''}`}>
                                {overLimit ? (
                                    <p>
                                        <AlertTriangle size={15} aria-hidden /> Tienes <AnimatedCount value={counts.jugando} /> juegos a la vez y tu límite es {limit}.
                                        ¿Pausas alguno?
                                    </p>
                                ) : (
                                    <p>
                                        <AnimatedCount value={counts.jugando} /> de {limit} juegos a la vez.
                                    </p>
                                )}
                                <div className="lib-limit__stepper" role="group" aria-label="Límite de juegos en Jugando">
                                    <Button type="button" size="icon" variant="ghost" onClick={() => changeLimit(limit - 1)} disabled={limit <= 1} aria-label="Bajar el límite">
                                        <Minus aria-hidden />
                                    </Button>
                                    <span aria-live="polite">Límite: {limit}</span>
                                    <Button type="button" size="icon" variant="ghost" onClick={() => changeLimit(limit + 1)} disabled={limit >= 20} aria-label="Subir el límite">
                                        <Plus aria-hidden />
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="lib-filters">
                            {(mixedOwnership || filters.own !== 'todos') && (
                                <Segmented
                                    aria-label="Comprados o sin comprar"
                                    value={filters.own}
                                    options={OWN_FILTERS}
                                    labels={OWN_FILTER_LABELS}
                                    icons={OWN_ICONS}
                                    onChange={(k) => setFilters((f) => ({ ...f, own: k }))}
                                />
                            )}
                            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                                <SelectTrigger className="lib-select" aria-label="Ordenar">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {sortsFor(tab).map((s) => (
                                        <SelectItem key={s} value={s}>
                                            {SORT_LABELS[s]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {options.genres.length > 0 && (
                                <Select
                                    value={filters.genre ?? ALL}
                                    onValueChange={(v) => setFilters((f) => ({ ...f, genre: v === ALL ? null : v }))}
                                >
                                    <SelectTrigger className={`lib-select${filters.genre ? ' is-set' : ''}`} aria-label="Género">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ALL}>Todos los géneros</SelectItem>
                                        {options.genres.map((g) => (
                                            <SelectItem key={g} value={g}>
                                                {g}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            {options.years.length > 0 && (
                                <Select
                                    value={filters.completedYear === null ? ALL : String(filters.completedYear)}
                                    onValueChange={(v) => setFilters((f) => ({ ...f, completedYear: v === ALL ? null : Number(v) }))}
                                >
                                    <SelectTrigger className={`lib-select${filters.completedYear !== null ? ' is-set' : ''}`} aria-label="Año de completado">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ALL}>Cualquier año</SelectItem>
                                        {options.years.map((y) => (
                                            <SelectItem key={y} value={String(y)}>
                                                Completados en {y}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            {(tab === 'completado' || tab === 'todos' || tab === 'abandonado' || tab === 'ya_jugado' || tab === 'favorito' || tab === 'sin_final') && (
                                <Select
                                    value={filters.minRating === null ? ALL : String(filters.minRating)}
                                    onValueChange={(v) => setFilters((f) => ({ ...f, minRating: v === ALL ? null : Number(v) }))}
                                >
                                    <SelectTrigger className={`lib-select${filters.minRating !== null ? ' is-set' : ''}`} aria-label="Nota mínima">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ALL}>Cualquier nota</SelectItem>
                                        {[9, 8, 7, 5].map((n) => (
                                            <SelectItem key={n} value={String(n)}>
                                                Nota {n} o más
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <Select
                                value={filters.achievements}
                                onValueChange={(v) => setFilters((f) => ({ ...f, achievements: v as AchievementFilter }))}
                            >
                                <SelectTrigger className={`lib-select${filters.achievements !== 'todos' ? ' is-set' : ''}`} aria-label="Logros">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {(Object.keys(ACHIEVEMENT_FILTER_LABELS) as AchievementFilter[]).map((k) => (
                                        <SelectItem key={k} value={k}>
                                            {ACHIEVEMENT_FILTER_LABELS[k]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={filters.duration}
                                onValueChange={(v) => setFilters((f) => ({ ...f, duration: v as DurationFilter }))}
                            >
                                <SelectTrigger
                                    className={`lib-select${filters.duration !== 'todas' ? ' is-set' : ''}`}
                                    aria-label="Duración"
                                    title="Duración de la historia según HowLongToBeat (o la mediana de SteamSpy si no hay dato)"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {(Object.keys(DURATION_FILTER_LABELS) as DurationFilter[]).map((k) => (
                                        <SelectItem key={k} value={k}>
                                            {DURATION_FILTER_LABELS[k]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={filters.marks} onValueChange={(v) => setFilters((f) => ({ ...f, marks: v as MarkFilter }))}>
                                <SelectTrigger className={`lib-select${filters.marks !== 'todas' ? ' is-set' : ''}`} aria-label="Marcas">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {(Object.keys(MARK_FILTER_LABELS) as MarkFilter[]).map((k) => (
                                        <SelectItem key={k} value={k}>
                                            {MARK_FILTER_LABELS[k]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {hasFilters(filters) && (
                                <Button type="button" size="sm" variant="ghost" onClick={() => setFilters(NO_FILTERS)}>
                                    <X aria-hidden /> Quitar filtros
                                </Button>
                            )}
                        </div>

                        {isHomeTab && (
                            <p className="lib-home-note">
                                <Pin size={14} aria-hidden />
                                {homeChanged
                                    ? 'Has cambiado el orden, los filtros o la vista de tu lista de inicio: guárdalos para que se abra así.'
                                    : 'La biblioteca se abre siempre aquí, con este orden, filtros y vista.'}
                            </p>
                        )}

                        {list.length > 0 && (
                            <p className="lib-note">
                                {tab === 'pendiente' && list.length > 1 && (
                                    <span>
                                        {canDrag
                                            ? 'Arrastra desde el asa para ordenar tus pendientes: el primero es el siguiente al que jugarás.'
                                            : 'Para ordenar arrastrando, elige "Mi orden" y quita los filtros.'}
                                    </span>
                                )}
                                <span className="hg-keyhint">
                                    <kbd>↑</kbd> <kbd>↓</kbd> o <kbd>j</kbd> <kbd>k</kbd> para moverte · <kbd>Enter</kbd> abre la ficha
                                </span>
                            </p>
                        )}

                        <div key={`${tab}-${view}`} className={`lib-swap${switched ? ' hg-swap-in' : ''}`}>
                        {list.length === 0 && ghosts.length === 0 ? (
                            <LibraryEmptyView
                                key={`${tab}-${hasFilters(filters) ? 'f' : ''}`}
                                empty={libraryEmpty(tab, counts, hasFilters(filters))}
                                linked={steamLinked}
                                onTab={changeTab}
                                onClear={() => setFilters(NO_FILTERS)}
                                onSynced={reload}
                            />
                        ) : (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                                <SortableContext
                                    items={shown.map((g) => g.appid)}
                                    strategy={view === 'cuadricula' ? rectSortingStrategy : verticalListSortingStrategy}
                                    disabled={!canDrag}
                                >
                                    <KeyboardList
                                        className={view === 'cuadricula' ? 'hg-cards lib-grid lib-list' : `hg-rows lib-list${showStatus ? ' has-status' : ''}`}
                                        label={`Juegos: ${TAB_LABELS[tab]}`}
                                    >
                                        {withGhosts(shown, ghosts).map((item, i) =>
                                            item.ghost ? (
                                                <LibraryItemView
                                                    key={`ghost-${item.ghost.key}`}
                                                    game={item.ghost.game}
                                                    view={view}
                                                    showStatus={showStatus}
                                                    showOwnership={tab === 'pendiente' || !item.ghost.game.owned}
                                                    ghostHeight={item.ghost.height}
                                                />
                                            ) : (
                                                <LibraryItem
                                                    key={item.game.appid}
                                                    game={item.game}
                                                    view={view}
                                                    draggable={canDrag}
                                                    position={canDrag ? item.index + 1 : null}
                                                    showStatus={showStatus}
                                                    showOwnership={tab === 'pendiente' || !item.game.owned}
                                                    priority={item.index < 6}
                                                    tone={tint[item.game.appid] ?? null}
                                                    fresh={fresh[item.game.appid]}
                                                    shifted={shift !== null && i >= shift}
                                                    onAct={(a) => act(item.game, a)}
                                                    onChange={(patch) => (patch === null ? applyChange(item.game, null) : patchGame(item.game.appid, patch))}
                                                    onError={setError}
                                                />
                                            ),
                                        )}
                                    </KeyboardList>
                                </SortableContext>
                            </DndContext>
                        )}

                        </div>

                        {list.length > visible && (
                            <div className="lib-more">
                                <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE)}>
                                    Mostrar más ({list.length - visible})
                                </Button>
                            </div>
                        )}
                    </section>
                </div>

                <div className="tray-float">
                    <AnimatePresence>
                        {toast && (
                            <motion.div
                                key={toast.id}
                                className="tray-float__toast"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0, transition: reduce ? { duration: 0 } : { duration: 0.2, ease: EASE_OUT } }}
                                exit={{ opacity: 0, y: 8, transition: reduce ? { duration: 0 } : { duration: 0.16, ease: 'easeIn' } }}
                            >
                                <LibToast toast={toast} onUndo={() => void undo()} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                {flights.map((f) => (
                    <TrayFly key={f.id} flight={f} onDone={endFlight} />
                ))}
                <p className="sr-only" aria-live="polite">
                    {announce}
                </p>
            </div>
        </SkeletonSwap>
    )
}

type ListItem = { ghost: null; game: LibraryGame; index: number } | { ghost: Ghost; game: null; index: number }

/** La lista visible con las filas que están saliendo en su sitio (tras la fila que tenían encima). */
function withGhosts(shown: LibraryGame[], ghosts: Ghost[]): ListItem[] {
    if (ghosts.length === 0) return shown.map((game, index) => ({ ghost: null, game, index }))
    const ids = new Set(shown.map((g) => g.appid))
    const out: ListItem[] = []
    // La primera fila, o una cuya vecina también se ha ido: al principio.
    for (const ghost of ghosts) if (ghost.anchor === null || !ids.has(ghost.anchor)) out.push({ ghost, game: null, index: -1 })
    shown.forEach((game, index) => {
        out.push({ ghost: null, game, index })
        for (const ghost of ghosts) if (ghost.anchor === game.appid) out.push({ ghost, game: null, index: -1 })
    })
    return out
}

/** Aviso con «Deshacer» (y Ctrl + Z) durante 5 s, con el mismo aspecto que el de la bandeja. */
function LibToast({ toast, onUndo }: { toast: LibToastData; onUndo: () => void }) {
    return (
        <div className="tray-toast" role="status">
            <span className="tray-toast__text">
                <b>{toast.name}</b>
                {toast.status ? (
                    <>
                        <ArrowRight aria-hidden />
                        <StatusChip status={toast.status} />
                    </>
                ) : (
                    toast.left && <span>fuera de {TAB_LABELS[toast.left]}</span>
                )}
            </span>
            <Button type="button" size="sm" variant="ghost" className="tray-toast__undo" onClick={onUndo}>
                <Undo2 aria-hidden /> Deshacer <kbd className="hg-kbd">Ctrl + Z</kbd>
            </Button>
        </div>
    )
}

/** Vacío de la biblioteca: el de la lista (su icono y su color), el de los filtros (neutro), el de todo en la bandeja o el de Steam. */
function LibraryEmptyView({
    empty,
    linked,
    onTab,
    onClear,
    onSynced,
}: {
    empty: LibraryEmpty
    linked: boolean | null
    onTab: (tab: LibraryTab) => void
    onClear: () => void
    onSynced: () => void
}) {
    if (empty.kind === 'steam') return <SteamEmpty linked={linked} search onSynced={onSynced} />
    if (empty.kind === 'filters')
        return (
            <EmptyState
                tone="neutral"
                icon={<FilterX />}
                title="Ningún juego cumple los filtros"
                action={
                    <Button variant="secondary" size="sm" onClick={onClear}>
                        <X aria-hidden /> Quitar filtros
                    </Button>
                }
            >
                Sin filtros hay {empty.total} en esta lista.
            </EmptyState>
        )
    if (empty.kind === 'unclassified')
        return (
            <EmptyState
                size="page"
                tone={listClass('bandeja')}
                icon={<Inbox />}
                title="Aún no has clasificado ningún juego"
                action={
                    <Button asChild>
                        <Link href="/biblioteca/bandeja">
                            <Inbox aria-hidden /> Clasificar la bandeja
                        </Link>
                    </Button>
                }
            >
                Tienes {empty.tray} {empty.tray === 1 ? 'juego' : 'juegos'} en la bandeja. Un clic, o una tecla, y cada uno a su lista.
            </EmptyState>
        )
    const Icon = empty.tab === 'todos' ? Library : LIST_ICONS[empty.tab]
    const a = empty.action
    const action =
        a?.kind === 'tab' ? (
            <Button variant="secondary" size="sm" onClick={() => onTab(a.tab)}>
                Ver {TAB_LABELS[a.tab]} ({a.count})
            </Button>
        ) : a?.kind === 'tray' ? (
            <Button variant="secondary" size="sm" asChild>
                <Link href="/biblioteca/bandeja">
                    <Inbox aria-hidden /> Clasificar la bandeja ({a.count})
                </Link>
            </Button>
        ) : a?.kind === 'search' ? (
            <Button variant="secondary" size="sm" onClick={openGameSearch}>
                <Search aria-hidden /> Buscar un juego
            </Button>
        ) : undefined
    return (
        <EmptyState tone={listClass(empty.tab)} icon={<Icon />} title={`Nada en ${TAB_LABELS[empty.tab]}`} action={action}>
            {empty.text}
        </EmptyState>
    )
}

/** Muelle del indicador activo, el mismo que el de la barra lateral (`nav-pill`). */
const RAIL_SPRING = { type: 'spring', stiffness: 500, damping: 40 } as const

function RailItem({
    tab,
    count,
    current,
    pinned,
    reduce,
    onSelect,
}: {
    tab: LibraryTab
    count: number
    current: boolean
    pinned: boolean
    reduce: boolean
    onSelect: (tab: LibraryTab) => void
}) {
    return (
        <button
            type="button"
            className={`lib-rail__item ${listClass(tab)}`}
            aria-current={current ? 'page' : undefined}
            data-rail={tab}
            onClick={() => onSelect(tab)}
        >
            {current && <motion.span layoutId="lib-rail-pill" className="lib-rail__pill" transition={reduce ? { duration: 0 } : RAIL_SPRING} />}
            <TabIcon tab={tab} />
            <span className="lib-rail__label">
                {TAB_LABELS[tab]}
                {pinned && <Pin className="lib-rail__pin" aria-label="Lista de inicio" />}
            </span>
            <AnimatedCount value={count} className="lib-rail__count" />
        </button>
    )
}

function LibraryItem({
    game,
    view,
    draggable,
    position,
    showStatus,
    showOwnership,
    priority,
    tone,
    fresh,
    shifted,
    onAct,
    onChange,
    onError,
}: {
    game: LibraryGame
    view: LibraryView
    draggable: boolean
    position: number | null
    showStatus: boolean
    showOwnership: boolean
    priority: boolean
    /** Lista de destino mientras la fila se tiñe antes de salir. */
    tone: GameStatus | null
    fresh: Fresh | undefined
    /** Tarjeta que se mueve a otro hueco de la rejilla (se funde). */
    shifted: boolean
    onAct: (act: GameMenuAct) => void
    onChange: (patch: Partial<LibraryGame> | null) => void
    onError: (message: string) => void
}) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: game.appid,
        disabled: !draggable,
    })
    const name = game.name ?? `App ${game.appid}`
    const style: CSSProperties = { transform: CSS.Translate.toString(transform) ?? '', transition: transition ?? '' }

    const drag =
        draggable || position !== null ? (
            <span className="lib-drag">
                {draggable && (
                    <button type="button" ref={setActivatorNodeRef} className="lib-handle" aria-label={`Mover ${name}`} {...attributes} {...listeners}>
                        <GripVertical size={16} aria-hidden />
                    </button>
                )}
                {position !== null && <span className="lib-position">{position}</span>}
            </span>
        ) : null

    return (
        <LibraryItemView
            game={game}
            view={view}
            showStatus={showStatus}
            showOwnership={showOwnership}
            priority={priority}
            nodeRef={setNodeRef}
            style={style}
            drag={drag}
            dragging={isDragging}
            tone={tone}
            fresh={fresh}
            shifted={shifted}
            menu={<GameMenu game={game} onAct={onAct} onChange={onChange} onError={onError} />}
        />
    )
}

/**
 * Una fila (o tarjeta) de la lista, sin arrastre: la usa `LibraryItem` y las filas que están saliendo (`ghostHeight`,
 * que salen, se apagan y se pliegan desde esa altura; en la rejilla, solo se funden).
 */
function LibraryItemView({
    game,
    view,
    showStatus,
    showOwnership,
    priority = false,
    nodeRef,
    style,
    drag = null,
    dragging = false,
    tone = null,
    fresh,
    shifted = false,
    menu,
    ghostHeight,
}: {
    game: LibraryGame
    view: LibraryView
    showStatus: boolean
    showOwnership: boolean
    priority?: boolean
    nodeRef?: (el: HTMLElement | null) => void
    style?: CSSProperties
    drag?: ReactNode
    dragging?: boolean
    tone?: GameStatus | null
    fresh?: Fresh
    shifted?: boolean
    menu?: ReactNode
    ghostHeight?: number
}) {
    const pct = achievementPercent(game)
    const name = game.name ?? `App ${game.appid}`
    const perfect = isPerfect(game)
    const minutes = estimatedMinutes(game)
    const ghost = ghostHeight !== undefined
    // Prestado por el grupo familiar que ya no está: se ve como uno tuyo pero en gris (#86).
    const gone = !!game.family_gone_at
    // El color de la franja sale de la clase st-<estado> (lists.css); mientras se tiñe antes de salir, el del destino.
    const status = tone ?? game.status
    const motionClass = [tone && 'is-going', fresh?.back && 'is-back', shifted && 'is-shift', ghost && 'lib-ghost'].filter(Boolean).join(' ')
    const liStyle: CSSProperties = ghost ? ({ '--h': `${ghostHeight}px` } as CSSProperties) : (style ?? {})
    const chip = showStatus ? <StatusChip status={status} changed={!!fresh?.status || !!tone} /> : null
    const flags = <MarkFlags favorite={game.favorite} endless={game.endless} lit={fresh?.lit} leaving={fresh?.leaving} />
    const menuNode = ghost ? <span className="hg-icon-btn" aria-hidden /> : menu

    const meta = (
        <>
            {game.steam_source === 'family' ? (
                <FamilyTag game={game} />
            ) : (
                showOwnership &&
                (game.owned ? (
                    <span className="lib-own">
                        <Check aria-hidden /> Comprado
                    </span>
                ) : (
                    <span className="lib-own lib-own--no">
                        <ShoppingCart aria-hidden /> Sin comprar
                    </span>
                ))
            )}
            {(game.owned || gone) && (
                <span className="lib-meta">
                    <Clock aria-hidden /> {formatHours(game.playtime_forever)}
                </span>
            )}
            {(game.status === 'pendiente' || !game.owned) && minutes !== null && !game.endless && (
                <span className="lib-meta" title="Duración de la historia">
                    <Hourglass aria-hidden /> {formatHours(minutes)}
                </span>
            )}
            {game.rating !== null && (
                <span className={`hg-score hg-tint sc-${ratingTier(game.rating)}`} title="Tu nota">
                    <Star aria-hidden /> {String(game.rating).replace('.', ',')}
                </span>
            )}
            {game.metacritic_score !== null && (
                <span className={`hg-score hg-tint sc-${metacriticScore(game.metacritic_score).tier}`} title={`Metacritic: ${metacriticScore(game.metacritic_score).label}`}>
                    {game.metacritic_score}
                </span>
            )}
        </>
    )

    const progress = !game.owned && !gone ? (
        <PriceTag game={game} />
    ) : pct !== null ? (
        <span className="hg-row__prog" title={`${game.achievements_unlocked ?? 0} de ${game.achievements_total} logros`}>
            <span className="hg-row__prog-label">
                <span>
                    <b>{game.achievements_unlocked ?? 0}</b> / {game.achievements_total} logros
                </span>
                <span className={perfect ? 'lib-perfect' : undefined}>{pct} %</span>
            </span>
            <span className={`hg-bar${perfect ? ' is-done' : ''}`} aria-hidden>
                <span style={{ width: `${pct}%` }} />
            </span>
        </span>
    ) : (
        <span className="hg-row__prog hg-row__prog--none">Sin logros</span>
    )

    const cover = (
        <>
            <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="header" sizes={view === 'lista' ? '112px' : '(max-width: 640px) 45vw, 200px'} priority={priority} />
            {!game.owned && !gone && (
                <span className="lib-cover-tag">
                    <ShoppingCart aria-hidden /> Sin comprar
                </span>
            )}
        </>
    )

    const link = (cls: string) =>
        ghost ? (
            <span className={cls}>{name}</span>
        ) : (
            <Link href={`/juego/${game.appid}`} className={cls} title={view === 'lista' ? undefined : name} data-row-link>
                {name}
            </Link>
        )

    if (view === 'lista') {
        return (
            <li
                ref={nodeRef}
                style={liStyle}
                data-appid={ghost ? undefined : game.appid}
                aria-hidden={ghost || undefined}
                className={`hg-row lib-row st-${status}${drag ? ' has-drag' : ''}${dragging ? ' is-dragging' : ''}${game.owned ? '' : gone ? ' is-gone' : ' is-unowned'}${motionClass ? ` ${motionClass}` : ''}`}
            >
                {drag}
                <span className="hg-row__cover lib-cover">{cover}</span>
                <span className="hg-row__main">
                    <span className="lib-row__name">
                        {link('hg-row__link')}
                        {flags}
                    </span>
                    <span className="hg-row__meta lib-row__meta">{meta}</span>
                </span>
                {progress}
                <span className="lib-row__end">
                    {chip}
                    {menuNode}
                </span>
            </li>
        )
    }

    return (
        <li
            ref={nodeRef}
            style={liStyle}
            data-appid={ghost ? undefined : game.appid}
            aria-hidden={ghost || undefined}
            className={`hg-card lib-card st-${status}${dragging ? ' is-dragging' : ''}${game.owned ? '' : gone ? ' is-gone' : ' is-unowned'}${motionClass ? ` ${motionClass}` : ''}`}
        >
            <span className="hg-card__cover lib-cover">{cover}</span>
            <span className="hg-card__body">
                <span className="lib-row__name">
                    {link('hg-card__link')}
                    {flags}
                </span>
                <span className="hg-card__meta lib-row__meta">{meta}</span>
                {game.owned || gone ? (
                    pct !== null && (
                        <span className={`hg-bar lib-card__bar${perfect ? ' is-done' : ''}`} aria-hidden>
                            <span style={{ width: `${pct}%` }} />
                        </span>
                    )
                ) : (
                    <PriceTag game={game} />
                )}
                <span className="lib-card__foot">
                    {chip ?? <span />}
                    {menuNode}
                </span>
            </span>
            {drag && <span className="lib-card__drag">{drag}</span>}
        </li>
    )
}

/** Prestado por el grupo familiar de Steam (#86): «Del grupo · laura_g», o «Ya no está en el grupo» si dejó de compartirse. */
function FamilyTag({ game }: { game: Pick<LibraryGame, 'family_owners' | 'family_gone_at'> }) {
    const owners = game.family_owners ?? []
    const who = owners.length > 1 ? `${owners[0]} +${owners.length - 1}` : owners[0]
    if (game.family_gone_at) {
        return (
            <span className="lib-own lib-own--gone" title={`${owners.join(', ') || 'Quien lo prestaba'} ya no lo comparte en tu grupo familiar`}>
                <Users aria-hidden /> Ya no está en el grupo
            </span>
        )
    }
    return (
        <span className="lib-own lib-own--fam" title={who ? `Te lo presta ${owners.join(', ')} en tu grupo familiar de Steam` : 'Te lo presta tu grupo familiar de Steam'}>
            <Users aria-hidden /> Del grupo{who && <span className="lib-own__who">· {who}</span>}
        </span>
    )
}

'use client'

import { Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react'
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
import {
    AlertTriangle,
    Check,
    Clock,
    GripVertical,
    Heart,
    Hourglass,
    LayoutGrid,
    Library,
    List,
    Minus,
    Pin,
    Plus,
    Search,
    ShoppingCart,
    Star,
    X,
} from 'lucide-react'
import { safeGetSession } from '@/lib/supabase/client'
import {
    DEFAULT_PLAYING_LIMIT,
    formatHours,
    getLibraryHome,
    getPlayingLimit,
    loadLibrary,
    reorderBacklog,
    setLibraryHome,
    setPlayingLimit,
    type LibraryGame,
} from '@/lib/tracker'
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
import Loader from '@/components/Loader'
import KeyboardList from '@/components/KeyboardList'
import GameCover from '@/components/tracker/GameCover'
import GameMenu from '@/components/tracker/GameMenu'
import { openGameSearch } from '@/components/tracker/GameSearch'
import SearchShortcut from '@/components/tracker/SearchShortcut'
import { LIST_ICONS, MarkFlags, StatusChip, listClass } from '@/components/tracker/status'
import { PriceTag } from '@/components/wishlist/PriceInfo'
import '@/components/wishlist/wishlist.css'
import './biblioteca.css'

const PAGE = 60
const VIEW_KEY = 'hubgames:biblioteca-vista'
const ALL = 'all'

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

export default function BibliotecaPage() {
    return (
        <Suspense fallback={<Loader label="Cargando biblioteca" />}>
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
    // Solo se pinta en el cliente (antes sale el Loader), así que se puede leer localStorage al iniciar.
    const [view, setView] = useState<LibraryView>(() =>
        typeof window !== 'undefined' && localStorage.getItem(VIEW_KEY) === 'cuadricula' ? 'cuadricula' : 'lista',
    )
    const [appliedTab, setAppliedTab] = useState<LibraryTab | null>(null)
    const [sort, setSort] = useState<SortKey>('nombre')
    const [filters, setFilters] = useState<LibraryFilters>(NO_FILTERS)
    const [visible, setVisible] = useState(PAGE)
    const [error, setError] = useState('')
    const [savingHome, setSavingHome] = useState(false)

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
        })
    }, [router])

    // Sin ?estado= se abre la lista de inicio (📌) o, si no hay, "Todos".
    const tab: LibraryTab = param ?? home?.tab ?? 'todos'

    // Al cambiar de lista (también con atrás/adelante): la de inicio abre con su orden, filtros y vista; el resto, con
    // su orden por defecto y sin filtros.
    if (home !== undefined && appliedTab !== tab) {
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
    const mixedOwnership = inList.some((g) => !g.owned)
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

    if (!games || home === undefined) return <Loader label="Cargando biblioteca" />

    const overLimit = counts.jugando > limit
    const HeadIcon = tab === 'todos' ? Library : LIST_ICONS[tab]

    return (
        <div className="biblioteca">
            <header className="page-head">
                <div>
                    <h1 className="page-title">Biblioteca</h1>
                    <p className="page-subtitle">
                        {counts.classified} {counts.classified === 1 ? 'juego clasificado' : 'juegos clasificados'}
                        {counts.jugando > 0 && ` · ${counts.jugando} en curso`}
                        {counts.unowned > 0 && ` · ${counts.unowned} ${counts.unowned === 1 ? 'pendiente' : 'pendientes'} sin comprar`}
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
                <nav className="lib-rail" aria-label="Listas">
                    {RAIL.map((group) => (
                        <div key={group.title ?? 'todos'} className="lib-rail__group">
                            {group.title && <p className="lib-rail__title">{group.title}</p>}
                            {group.tabs.map((t) => (
                                <RailItem key={t} tab={t} count={counts[t]} current={tab === t} pinned={home?.tab === t} onSelect={changeTab} />
                            ))}
                        </div>
                    ))}
                    <div className="lib-rail__group lib-rail__group--tray">
                        <RailItem tab="bandeja" count={counts.bandeja} current={tab === 'bandeja'} pinned={home?.tab === 'bandeja'} onSelect={changeTab} />
                    </div>
                </nav>

                <section className={`lib-main ${listClass(tab)}`} aria-labelledby="lib-list-title">
                    <div className="lib-listhead">
                        <span className="lib-listhead__icon hg-tint">
                            <HeadIcon aria-hidden />
                        </span>
                        <div className="lib-listhead__text">
                            <h2 id="lib-list-title">{TAB_LABELS[tab]}</h2>
                            <p>{TAB_HINTS[tab]}</p>
                        </div>
                        <div className="lib-listhead__actions">
                            {tab === 'bandeja' && counts.bandeja > 0 && (
                                <Button size="sm" asChild>
                                    <Link href="/biblioteca/bandeja">Clasificar uno a uno</Link>
                                </Button>
                            )}
                            <div className="hg-seg" role="group" aria-label="Vista">
                                <button type="button" className="hg-seg__opt" aria-pressed={view === 'lista'} onClick={() => changeView('lista')} title="Lista">
                                    <List aria-hidden />
                                    <span className="sr-only">Lista</span>
                                </button>
                                <button
                                    type="button"
                                    className="hg-seg__opt"
                                    aria-pressed={view === 'cuadricula'}
                                    onClick={() => changeView('cuadricula')}
                                    title="Rejilla"
                                >
                                    <LayoutGrid aria-hidden />
                                    <span className="sr-only">Rejilla</span>
                                </button>
                            </div>
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
                                    <AlertTriangle size={15} aria-hidden /> Tienes {counts.jugando} juegos a la vez y tu límite es {limit}.
                                    ¿Pausas alguno?
                                </p>
                            ) : (
                                <p>
                                    {counts.jugando} de {limit} juegos a la vez.
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
                            <div className="hg-seg" role="group" aria-label="Comprados o sin comprar">
                                {(Object.keys(OWN_FILTER_LABELS) as OwnFilter[]).map((k) => (
                                    <button
                                        key={k}
                                        type="button"
                                        className="hg-seg__opt"
                                        aria-pressed={filters.own === k}
                                        onClick={() => setFilters((f) => ({ ...f, own: k }))}
                                    >
                                        {k === 'comprados' && <Check aria-hidden />}
                                        {k === 'sin_comprar' && <ShoppingCart aria-hidden />}
                                        {OWN_FILTER_LABELS[k]}
                                    </button>
                                ))}
                            </div>
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

                    {list.length === 0 ? (
                        <div className="hg-empty lib-empty">
                            {hasFilters(filters) ? (
                                <>
                                    <p>Ningún juego cumple los filtros.</p>
                                    <Button variant="secondary" onClick={() => setFilters(NO_FILTERS)}>
                                        Quitar filtros
                                    </Button>
                                </>
                            ) : counts.classified === 0 && tab !== 'bandeja' ? (
                                <>
                                    <p>Aún no has clasificado ningún juego.</p>
                                    <Button variant="secondary" asChild>
                                        <Link href={counts.bandeja > 0 ? '/biblioteca/bandeja' : '/perfil'}>
                                            {counts.bandeja > 0 ? 'Clasificar la bandeja' : 'Conectar Steam en el perfil'}
                                        </Link>
                                    </Button>
                                </>
                            ) : tab === 'bandeja' ? (
                                <p>No queda nada en la bandeja: todo está clasificado.</p>
                            ) : (
                                <p>No tienes juegos en {TAB_LABELS[tab].toLowerCase()}.</p>
                            )}
                        </div>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                            <SortableContext
                                items={shown.map((g) => g.appid)}
                                strategy={view === 'cuadricula' ? rectSortingStrategy : verticalListSortingStrategy}
                                disabled={!canDrag}
                            >
                                <KeyboardList className={view === 'cuadricula' ? 'hg-cards lib-grid' : `hg-rows lib-list${showStatus ? ' has-status' : ''}`} label={`Juegos: ${TAB_LABELS[tab]}`}>
                                    {shown.map((game, i) => (
                                        <LibraryItem
                                            key={game.appid}
                                            game={game}
                                            view={view}
                                            draggable={canDrag}
                                            position={canDrag ? i + 1 : null}
                                            showStatus={showStatus}
                                            showOwnership={tab === 'pendiente' || !game.owned}
                                            priority={i < 6}
                                            onChange={(patch) => patchGame(game.appid, patch)}
                                            onError={setError}
                                        />
                                    ))}
                                </KeyboardList>
                            </SortableContext>
                        </DndContext>
                    )}

                    {list.length > visible && (
                        <div className="lib-more">
                            <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE)}>
                                Mostrar más ({list.length - visible})
                            </Button>
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}

function RailItem({
    tab,
    count,
    current,
    pinned,
    onSelect,
}: {
    tab: LibraryTab
    count: number
    current: boolean
    pinned: boolean
    onSelect: (tab: LibraryTab) => void
}) {
    return (
        <button
            type="button"
            className={`lib-rail__item ${listClass(tab)}${tab === 'bandeja' ? ' lib-rail__item--tray' : ''}`}
            aria-current={current ? 'page' : undefined}
            onClick={() => onSelect(tab)}
        >
            <TabIcon tab={tab} />
            <span className="lib-rail__label">
                {TAB_LABELS[tab]}
                {pinned && <Pin className="lib-rail__pin" aria-label="Lista de inicio" />}
            </span>
            <span className="lib-rail__count">{count}</span>
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
    onChange: (patch: Partial<LibraryGame> | null) => void
    onError: (message: string) => void
}) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: game.appid,
        disabled: !draggable,
    })
    const pct = achievementPercent(game)
    const name = game.name ?? `App ${game.appid}`
    // El color de la franja sale de la clase st-<estado> (lists.css), como en el resto de listas.
    const style: CSSProperties = { transform: CSS.Translate.toString(transform) ?? '', transition: transition ?? '' }
    const perfect = isPerfect(game)
    const minutes = estimatedMinutes(game)

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

    const meta = (
        <>
            {showOwnership &&
                (game.owned ? (
                    <span className="lib-own">
                        <Check aria-hidden /> Comprado
                    </span>
                ) : (
                    <span className="lib-own lib-own--no">
                        <ShoppingCart aria-hidden /> Sin comprar
                    </span>
                ))}
            {game.owned && (
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

    const progress = !game.owned ? (
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
            {!game.owned && (
                <span className="lib-cover-tag">
                    <ShoppingCart aria-hidden /> Sin comprar
                </span>
            )}
        </>
    )

    const menu = <GameMenu game={game} onChange={onChange} onError={onError} />

    if (view === 'lista') {
        return (
            <li
                ref={setNodeRef}
                style={style}
                className={`hg-row lib-row st-${game.status}${drag ? ' has-drag' : ''}${isDragging ? ' is-dragging' : ''}${game.owned ? '' : ' is-unowned'}`}
            >
                {drag}
                <span className="hg-row__cover lib-cover">{cover}</span>
                <span className="hg-row__main">
                    <span className="lib-row__name">
                        <Link href={`/juego/${game.appid}`} className="hg-row__link" data-row-link>
                            {name}
                        </Link>
                        <MarkFlags favorite={game.favorite} endless={game.endless} />
                    </span>
                    <span className="hg-row__meta lib-row__meta">{meta}</span>
                </span>
                {progress}
                <span className="lib-row__end">
                    {showStatus && <StatusChip status={game.status} />}
                    {menu}
                </span>
            </li>
        )
    }

    return (
        <li ref={setNodeRef} style={style} className={`hg-card lib-card st-${game.status}${isDragging ? ' is-dragging' : ''}${game.owned ? '' : ' is-unowned'}`}>
            <span className="hg-card__cover lib-cover">{cover}</span>
            <span className="hg-card__body">
                <span className="lib-row__name">
                    <Link href={`/juego/${game.appid}`} className="hg-card__link" title={name} data-row-link>
                        {name}
                    </Link>
                    <MarkFlags favorite={game.favorite} endless={game.endless} />
                </span>
                <span className="hg-card__meta lib-row__meta">{meta}</span>
                {game.owned ? (
                    pct !== null && (
                        <span className={`hg-bar lib-card__bar${perfect ? ' is-done' : ''}`} aria-hidden>
                            <span style={{ width: `${pct}%` }} />
                        </span>
                    )
                ) : (
                    <PriceTag game={game} />
                )}
                <span className="lib-card__foot">
                    {showStatus ? <StatusChip status={game.status} /> : <span />}
                    {menu}
                </span>
            </span>
            {drag && <span className="lib-card__drag">{drag}</span>}
        </li>
    )
}

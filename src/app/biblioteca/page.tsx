'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
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
import { AlertTriangle, Clock, GripVertical, Inbox, LayoutGrid, Library, List, Minus, Plus, Search, Star, Trophy, X } from 'lucide-react'
import { safeGetSession } from '@/lib/supabase/client'
import {
    DEFAULT_PLAYING_LIMIT,
    STATUS_LABELS,
    formatHours,
    getPlayingLimit,
    loadLibrary,
    reorderBacklog,
    setPlayingLimit,
    type LibraryGame,
} from '@/lib/tracker'
import {
    ACHIEVEMENT_FILTER_LABELS,
    DURATION_FILTER_LABELS,
    LIBRARY_TABS,
    NO_FILTERS,
    SORT_LABELS,
    achievementPercent,
    filterOptions,
    hasFilters,
    inTab,
    matchesFilters,
    moveInOrder,
    sortGames,
    sortsFor,
    type AchievementFilter,
    type DurationFilter,
    type LibraryFilters,
    type LibraryTab,
    type SortKey,
} from '@/lib/library'
import { isPerfect } from '@/lib/tracker-rules'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Loader from '@/components/Loader'
import GameCover from '@/components/tracker/GameCover'
import { openGameSearch } from '@/components/tracker/GameSearch'
import { Reveal } from '@/components/motion'
import './biblioteca.css'

const PAGE = 60
const VIEW_KEY = 'hubgames:biblioteca-vista'
const ALL = 'all'

type View = 'cuadricula' | 'lista'

const TAB_LABELS: Record<LibraryTab, string> = {
    todos: 'Todos',
    jugando: 'Jugando',
    pendiente: 'Pendientes',
    pausado: 'Pausados',
    completado: 'Completados',
    abandonado: 'Abandonados',
    descartado: 'No me interesan',
}

function parseTab(value: string | null): LibraryTab {
    return LIBRARY_TABS.includes(value as LibraryTab) ? (value as LibraryTab) : 'todos'
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
    const tab = parseTab(searchParams.get('estado'))

    const [userId, setUserId] = useState<string | null>(null)
    const [games, setGames] = useState<LibraryGame[] | null>(null)
    const [limit, setLimit] = useState(DEFAULT_PLAYING_LIMIT)
    // Solo se pinta en el cliente (antes sale el Loader), así que se puede leer localStorage al iniciar.
    const [view, setView] = useState<View>(() =>
        typeof window !== 'undefined' && localStorage.getItem(VIEW_KEY) === 'lista' ? 'lista' : 'cuadricula',
    )
    const [sortTab, setSortTab] = useState(tab)
    const [sort, setSort] = useState<SortKey>(sortsFor(tab)[0])
    const [filters, setFilters] = useState<LibraryFilters>(NO_FILTERS)
    const [visible, setVisible] = useState(PAGE)
    const [error, setError] = useState('')

    useEffect(() => {
        safeGetSession().then(({ data: { session } }) => {
            if (!session) {
                router.push('/login')
                return
            }
            setUserId(session.user.id)
            getPlayingLimit(session.user.id).then(setLimit)
            loadLibrary()
                .then(setGames)
                .catch((e: Error) => {
                    setError(e.message)
                    setGames([])
                })
        })
    }, [router])

    // Cada pestaña abre con su ordenación por defecto (también al llegar con ?estado= o con atrás/adelante).
    if (sortTab !== tab) {
        setSortTab(tab)
        setSort(sortsFor(tab)[0])
        setFilters(NO_FILTERS)
        setVisible(PAGE)
    }

    const counts = useMemo(() => {
        const out = Object.fromEntries(LIBRARY_TABS.map((t) => [t, 0])) as Record<LibraryTab, number>
        let tray = 0
        for (const g of games ?? []) {
            if (g.status === 'bandeja') tray++
            else {
                out.todos++
                out[g.status]++
            }
        }
        return { ...out, tray }
    }, [games])

    const options = useMemo(() => filterOptions((games ?? []).filter((g) => inTab(g, tab))), [games, tab])
    const list = useMemo(
        () => sortGames((games ?? []).filter((g) => inTab(g, tab) && matchesFilters(g, filters)), sort),
        [games, tab, filters, sort],
    )
    const shown = list.slice(0, visible)
    const canDrag = tab === 'pendiente' && sort === 'manual' && !hasFilters(filters)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    function changeTab(next: LibraryTab) {
        router.replace(next === 'todos' ? '/biblioteca' : `/biblioteca?estado=${next}`, { scroll: false })
    }

    function changeView(next: View) {
        setView(next)
        localStorage.setItem(VIEW_KEY, next)
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

    if (!games) return <Loader label="Cargando biblioteca" />

    const overLimit = counts.jugando > limit

    return (
        <div className="biblioteca biblioteca--wide">
            <header className="page-head">
                <div>
                    <Reveal>
                        <span className="eyebrow">
                            <Library size={13} aria-hidden /> Tracker
                        </span>
                    </Reveal>
                    <Reveal delay={0.05}>
                        <h1 className="page-title">Biblioteca</h1>
                    </Reveal>
                    <Reveal delay={0.1}>
                        <p className="page-subtitle">
                            {counts.todos} {counts.todos === 1 ? 'juego clasificado' : 'juegos clasificados'}
                            {counts.jugando > 0 && `, ${counts.jugando} en curso`}.
                        </p>
                    </Reveal>
                </div>
                <div className="lib-head-actions">
                    <Button variant="secondary" onClick={openGameSearch}>
                        <Search aria-hidden /> Buscar juego
                    </Button>
                    {counts.tray > 0 && (
                        <Button variant="secondary" asChild>
                            <Link href="/biblioteca/bandeja">
                                <Inbox aria-hidden /> Bandeja <span className="lib-count">{counts.tray}</span>
                            </Link>
                        </Button>
                    )}
                </div>
            </header>

            {error && (
                <p className="alert alert--error" role="alert">
                    {error}
                </p>
            )}

            <nav className="lib-tabs" aria-label="Estados">
                {LIBRARY_TABS.map((t) => (
                    <button
                        key={t}
                        type="button"
                        aria-current={tab === t ? 'page' : undefined}
                        className={`tray-sort ${tab === t ? 'is-active' : ''}`}
                        onClick={() => changeTab(t)}
                    >
                        {TAB_LABELS[t]}
                        <span className="tray-sort__count">{counts[t]}</span>
                    </button>
                ))}
            </nav>

            {tab === 'jugando' && (
                <div className={`lib-limit glass ${overLimit ? 'is-over' : ''}`}>
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

            <div className="lib-toolbar">
                <div className="lib-filters">
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
                            <SelectTrigger className="lib-select" aria-label="Género">
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
                            <SelectTrigger className="lib-select" aria-label="Año de completado">
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
                    {(tab === 'completado' || tab === 'todos' || tab === 'abandonado') && (
                        <Select
                            value={filters.minRating === null ? ALL : String(filters.minRating)}
                            onValueChange={(v) => setFilters((f) => ({ ...f, minRating: v === ALL ? null : Number(v) }))}
                        >
                            <SelectTrigger className="lib-select" aria-label="Nota mínima">
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
                        <SelectTrigger className="lib-select" aria-label="Logros">
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
                        <SelectTrigger className="lib-select" aria-label="Duración" title="Mediana de SteamSpy hasta que llegue HowLongToBeat">
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
                    {hasFilters(filters) && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => setFilters(NO_FILTERS)}>
                            <X aria-hidden /> Quitar filtros
                        </Button>
                    )}
                </div>
                <div className="tray-sorts" role="group" aria-label="Vista">
                    <button
                        type="button"
                        className={`tray-sort ${view === 'cuadricula' ? 'is-active' : ''}`}
                        aria-pressed={view === 'cuadricula'}
                        onClick={() => changeView('cuadricula')}
                        title="Cuadrícula"
                    >
                        <LayoutGrid size={15} aria-hidden />
                        <span className="sr-only">Cuadrícula</span>
                    </button>
                    <button
                        type="button"
                        className={`tray-sort ${view === 'lista' ? 'is-active' : ''}`}
                        aria-pressed={view === 'lista'}
                        onClick={() => changeView('lista')}
                        title="Lista"
                    >
                        <List size={15} aria-hidden />
                        <span className="sr-only">Lista</span>
                    </button>
                </div>
            </div>

            {tab === 'pendiente' && list.length > 1 && (
                <p className="tray-note">
                    {canDrag
                        ? 'Arrastra desde el asa para ordenar tus pendientes: el primero es el siguiente al que jugarás.'
                        : 'Para ordenar arrastrando, elige "Mi orden" y quita los filtros.'}
                </p>
            )}

            {list.length === 0 ? (
                <div className="tray-empty glass">
                    <Library size={28} aria-hidden />
                    {hasFilters(filters) ? (
                        <>
                            <p>Ningún juego cumple los filtros.</p>
                            <Button variant="secondary" onClick={() => setFilters(NO_FILTERS)}>
                                Quitar filtros
                            </Button>
                        </>
                    ) : counts.todos === 0 ? (
                        <>
                            <p>Aún no has clasificado ningún juego.</p>
                            <Button variant="secondary" asChild>
                                <Link href={counts.tray > 0 ? '/biblioteca/bandeja' : '/perfil'}>
                                    {counts.tray > 0 ? 'Ir a la bandeja' : 'Conectar Steam en el perfil'}
                                </Link>
                            </Button>
                        </>
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
                        <ul className={view === 'cuadricula' ? 'lib-grid' : 'lib-list'}>
                            {shown.map((game, i) => (
                                <LibraryItem
                                    key={game.appid}
                                    game={game}
                                    view={view}
                                    draggable={canDrag}
                                    position={canDrag ? i + 1 : null}
                                    showStatus={tab === 'todos'}
                                    priority={i < 6}
                                />
                            ))}
                        </ul>
                    </SortableContext>
                </DndContext>
            )}

            {list.length > visible && (
                <div className="tray-more">
                    <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE)}>
                        Mostrar más ({list.length - visible})
                    </Button>
                </div>
            )}
        </div>
    )
}

function LibraryItem({
    game,
    view,
    draggable,
    position,
    showStatus,
    priority,
}: {
    game: LibraryGame
    view: View
    draggable: boolean
    position: number | null
    showStatus: boolean
    priority: boolean
}) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: game.appid,
        disabled: !draggable,
    })
    const pct = achievementPercent(game)
    const name = game.name ?? `App ${game.appid}`
    const style = { transform: CSS.Translate.toString(transform), transition }

    const handle = draggable ? (
        <button type="button" ref={setActivatorNodeRef} className="lib-handle" aria-label={`Mover ${name}`} {...attributes} {...listeners}>
            <GripVertical size={16} aria-hidden />
        </button>
    ) : null

    const meta = (
        <p className="lib-meta">
            <span>
                <Clock size={12} aria-hidden /> {formatHours(game.playtime_forever)}
            </span>
            {pct !== null && (
                <span title={`${game.achievements_unlocked ?? 0} de ${game.achievements_total} logros`}>
                    <Trophy size={12} aria-hidden /> {pct}%
                </span>
            )}
            {game.rating !== null && (
                <span className="lib-rating" title="Tu nota">
                    <Star size={12} aria-hidden /> {String(game.rating).replace('.', ',')}
                </span>
            )}
        </p>
    )

    if (view === 'lista') {
        return (
            <li ref={setNodeRef} style={style} className={`lib-row glass ${isDragging ? 'is-dragging' : ''}`}>
                {handle}
                {position !== null && <span className="lib-position">{position}</span>}
                <Link href={`/juego/${game.appid}`} className="lib-row__link">
                    <span className="lib-row__cover">
                        <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="header" sizes="120px" />
                    </span>
                    <span className="lib-row__info">
                        <span className="lib-row__name">
                            {name}
                            {isPerfect(game) && (
                                <span className="badge-100" title="Todos los logros desbloqueados">
                                    <Trophy size={11} aria-hidden /> 100%
                                </span>
                            )}
                        </span>
                        {meta}
                    </span>
                    {showStatus && <span className={`lib-status lib-status--${game.status}`}>{STATUS_LABELS[game.status]}</span>}
                    {pct !== null && (
                        <span className="lib-progress" aria-hidden>
                            <span style={{ width: `${pct}%` }} />
                        </span>
                    )}
                </Link>
            </li>
        )
    }

    return (
        <li ref={setNodeRef} style={style} className={`lib-card ${isDragging ? 'is-dragging' : ''}`}>
            <Link href={`/juego/${game.appid}`} className="lib-card__link">
                <span className="lib-card__cover">
                    <GameCover
                        appid={game.appid}
                        name={game.name}
                        headerImage={game.header_image}
                        variant="vertical"
                        sizes="(max-width: 640px) 45vw, 192px"
                        priority={priority}
                    />
                    {isPerfect(game) && (
                        <span className="badge-100 lib-card__badge" title="Todos los logros desbloqueados">
                            <Trophy size={11} aria-hidden /> 100%
                        </span>
                    )}
                    {showStatus && <span className={`lib-status lib-status--${game.status} lib-card__status`}>{STATUS_LABELS[game.status]}</span>}
                    {pct !== null && (
                        <span className="lib-progress lib-card__progress" aria-hidden>
                            <span style={{ width: `${pct}%` }} />
                        </span>
                    )}
                </span>
                <span className="lib-card__name">{name}</span>
                {meta}
            </Link>
            {(handle || position !== null) && (
                <span className="lib-card__drag">
                    {position !== null && <span className="lib-position">{position}</span>}
                    {handle}
                </span>
            )}
        </li>
    )
}

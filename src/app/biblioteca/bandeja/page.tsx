'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Award, ChevronDown, Clock, Hourglass, Inbox, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import {
    formatHours,
    restoreGames,
    setGamesStatus,
    statusSnapshot,
    STATUS_LABELS,
    type LibraryGame,
    type StatusSnapshot,
} from '@/lib/tracker'
import { isPerfect } from '@/lib/tracker-rules'
import { metacriticScore, steamReviewScore } from '@/lib/scores'
import {
    addToSession,
    destinationForKey,
    destinationKey,
    suggestDestination,
    TRAY_DESTINATIONS,
    TRAY_GROUPS,
    type TrayDestination,
    type TraySession,
    type TraySuggestion,
} from '@/lib/tray'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import Loader from '@/components/Loader'
import AnimatedCount from '@/components/AnimatedCount'
import KeyboardList from '@/components/KeyboardList'
import GameCover from '@/components/tracker/GameCover'
import CompleteDialog from '@/components/tracker/CompleteDialog'
import { LIST_ICONS, StatusChip } from '@/components/tracker/status'
import { TrayEmpty, TrayFly, TraySessionBox, TrayToast, type TrayFlight, type TrayToastData } from './TrayParts'
import '../biblioteca.css'

type SortKey = 'horas' | 'verguenza' | 'valorados' | 'nombre'

const SORTS: { key: SortKey; label: string }[] = [
    { key: 'horas', label: 'Más horas' },
    { key: 'verguenza', label: '0 horas' },
    { key: 'valorados', label: 'Mejor valorados' },
    { key: 'nombre', label: 'Nombre' },
]

const PAGE = 60
/** Tinte de la fila antes de salir, aviso de Deshacer y escalonado entre filas de un lote (máx. 8). */
const TINT_MS = 200
const TOAST_MS = 5000
const EASE_OUT = [0.22, 1, 0.36, 1] as const
const stagger = (j: number) => Math.min(j, 8) * 0.03

function sortGames(games: LibraryGame[], key: SortKey): LibraryGame[] {
    const byName = (a: LibraryGame, b: LibraryGame) => (a.name ?? '').localeCompare(b.name ?? '', 'es')
    switch (key) {
        case 'horas':
            return [...games].sort((a, b) => b.playtime_forever - a.playtime_forever || byName(a, b))
        case 'verguenza':
            return games.filter((g) => g.playtime_forever === 0).sort(byName)
        case 'valorados':
            return [...games].sort((a, b) => (b.steamspy_userscore ?? -1) - (a.steamspy_userscore ?? -1) || byName(a, b))
        case 'nombre':
            return [...games].sort(byName)
    }
}

async function loadTray(): Promise<LibraryGame[]> {
    const out: LibraryGame[] = []
    for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
            .from('hubgames_library')
            .select('*')
            .eq('status', 'bandeja')
            .order('appid')
            .range(from, from + 999)
        if (error) throw new Error(error.message)
        out.push(...(data as LibraryGame[]))
        if (data.length < 1000) return out
    }
}

/** Donde se escribe o hay un diálogo abierto, Ctrl + Z y Esc son de ese sitio. */
function ownsKeys(el: Element | null): boolean {
    return !!el?.closest('input:not([type="checkbox"]), textarea, select, [contenteditable="true"], [role="dialog"]')
}

/** Una acción de clasificar: lo necesario para deshacerla. */
interface TrayAction {
    id: number
    games: LibraryGame[]
    snapshots: StatusSnapshot[]
    status: TrayDestination
    write: Promise<void>
    undone: boolean
}

/** Horas, historia, logros y puntuaciones de una fila, con color. */
function RowMeta({ game }: { game: LibraryGame }) {
    const played = game.playtime_forever
    const story = game.hltb_main && game.hltb_main > 0 ? game.hltb_main : null
    const over = story !== null && played >= story
    return (
        <span className="tray-meta">
            {played === 0 ? (
                <span className="tray-fresh" title="Nunca lo has abierto">
                    Sin estrenar
                </span>
            ) : (
                <span className="tray-m" title="Horas jugadas">
                    <Clock aria-hidden />
                    <b>{formatHours(played)}</b>
                </span>
            )}
            {story !== null &&
                (played > 0 ? (
                    <span
                        className={`tray-m tray-story${over ? ' is-over' : ''}`}
                        title={`Historia según HowLongToBeat: ${formatHours(story)}${over ? '. Ya has jugado más' : ''}`}
                    >
                        <span className="tray-mini">
                            <span style={{ transform: `scaleX(${Math.min(played / story, 1).toFixed(2)})` }} />
                        </span>
                        de {formatHours(story)} de historia
                    </span>
                ) : (
                    <span className="tray-m" title="Historia según HowLongToBeat">
                        <Hourglass aria-hidden />
                        {formatHours(story)} de historia
                    </span>
                ))}
            {game.achievements_total ? (
                <span className="tray-m tray-m--ach" title="Logros">
                    <Award aria-hidden />
                    {game.achievements_unlocked ?? 0} / {game.achievements_total}
                    {isPerfect(game) && ' (100 %)'}
                </span>
            ) : null}
            {game.metacritic_score !== null &&
                (() => {
                    const s = metacriticScore(game.metacritic_score)
                    return (
                        <span className={`hg-score hg-tint sc-${s.tier}`} title={`Metacritic: ${s.label}`}>
                            {game.metacritic_score}
                        </span>
                    )
                })()}
            {game.steamspy_userscore !== null &&
                (() => {
                    const s = steamReviewScore(game.steamspy_userscore)
                    const Thumb = s.tier === 'bad' ? ThumbsDown : ThumbsUp
                    return (
                        <span className={`tray-rev hg-tint sc-${s.tier}`} title={`Reseñas de Steam: ${s.label}`}>
                            <Thumb aria-hidden />
                            <b>{game.steamspy_userscore} %</b>
                            <span>{s.label}</span>
                        </span>
                    )
                })()}
        </span>
    )
}

/** Chip «→ Destino» junto al nombre mientras se previsualiza o se va. */
function DestChip({ status }: { status: TrayDestination }) {
    const Icon = LIST_ICONS[status]
    return (
        <span className={`tray-dest hg-chip hg-tint st-${status}`} aria-hidden>
            <ArrowRight />
            <Icon />
            {STATUS_LABELS[status]}
        </span>
    )
}

export default function BandejaPage() {
    const router = useRouter()
    const reduce = useReducedMotion() ?? false
    const segId = useId()
    const [games, setGames] = useState<LibraryGame[] | null>(null)
    const [now, setNow] = useState(0)
    const [sort, setSort] = useState<SortKey>('horas')
    const [selected, setSelected] = useState<Set<number>>(new Set())
    const [visible, setVisible] = useState(PAGE)
    const [error, setError] = useState('')
    // Cola de «Completar juego»: uno tras otro (también en lote).
    const [queue, setQueue] = useState<LibraryGame[]>([])
    // Tras clasificar con el teclado, el foco pasa a la fila que ocupa el mismo sitio.
    const [focusIndex, setFocusIndex] = useState<number | null>(null)
    // Movimiento: entrada de las filas, destino que se previsualiza, filas que se van y las que vuelven al deshacer.
    const [entered, setEntered] = useState(false)
    const [resorted, setResorted] = useState(false)
    const [preview, setPreview] = useState<{ ids: number[]; status: TrayDestination } | null>(null)
    const [going, setGoing] = useState<Map<number, { status: TrayDestination; j: number }>>(new Map())
    const [back, setBack] = useState<Set<number>>(new Set())
    const [flights, setFlights] = useState<TrayFlight[]>([])
    // Lo clasificado en esta visita, el último destino usado (su chip entra con un pop) y el aviso de Deshacer.
    const [session, setSession] = useState<TraySession>({})
    const [fresh, setFresh] = useState<TrayDestination | null>(null)
    const [toast, setToast] = useState<TrayToastData | null>(null)
    const [sheetIds, setSheetIds] = useState<number[] | null>(null)
    const lastAction = useRef<TrayAction | null>(null)
    const seq = useRef(0)

    const reload = useCallback(() => {
        loadTray()
            .then((list) => {
                setNow(Date.now())
                setEntered(false)
                setGoing(new Map())
                setGames(list)
            })
            .catch((e: Error) => {
                setError(e.message)
                setGames((g) => g ?? [])
            })
    }, [])

    useEffect(() => {
        safeGetSession().then(({ data: { session } }) => {
            if (!session) {
                router.push('/login')
                return
            }
            reload()
        })
    }, [router, reload])

    // La entrada escalonada solo al llegar; luego (ordenar, deshacer) las filas no vuelven a entrar.
    useEffect(() => {
        if (!games || entered) return
        const t = setTimeout(() => setEntered(true), 700)
        return () => clearTimeout(t)
    }, [games, entered])

    const sorted = useMemo(() => sortGames(games ?? [], sort), [games, sort])
    const shown = sorted.slice(0, visible)
    const shameCount = useMemo(() => (games ?? []).filter((g) => g.playtime_forever === 0).length, [games])
    const suggestions = useMemo(() => {
        const map = new Map<number, TraySuggestion | null>()
        for (const g of games ?? []) map.set(g.appid, suggestDestination(g, now))
        return map
    }, [games, now])

    useEffect(() => {
        if (focusIndex === null) return
        const links = document.querySelectorAll<HTMLElement>('.tray-list > li:not(.is-going) [data-row-link]')
        const next = links[Math.min(focusIndex, links.length - 1)]
        next?.focus()
        next?.closest('li')?.scrollIntoView({ block: 'nearest' })
        setFocusIndex(null)
    }, [focusIndex, games])

    // El aviso de Deshacer dura 5 s; al irse, ya no se puede deshacer.
    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => {
            setToast(null)
            if (lastAction.current?.id === toast.id) lastAction.current = null
        }, TOAST_MS)
        return () => clearTimeout(t)
    }, [toast])

    /** Ficha con el icono de la lista que vuela desde la fila hasta «Biblioteca» en la navegación. */
    function launchFlight(appid: number, status: TrayDestination, count: number) {
        const row = document.querySelector(`.tray-list > li[data-appid="${appid}"]`)
        const target = Array.from(
            document.querySelectorAll<HTMLElement>('a.nav-link[href="/biblioteca"], a.nav-tab[href="/biblioteca"]'),
        ).find((el) => el.getBoundingClientRect().width > 0)
        if (!row || !target) return
        const a = row.getBoundingClientRect()
        const b = target.getBoundingClientRect()
        const tab = target.classList.contains('nav-tab')
        const flight: TrayFlight = {
            id: ++seq.current,
            status,
            count,
            from: { x: a.left + 10, y: a.top + a.height / 2 - 14 },
            to: { x: b.left + (tab ? b.width / 2 - 14 : 8), y: b.top + b.height / 2 - 14 },
        }
        setFlights((f) => [...f, flight])
    }

    const endFlight = useCallback((id: number) => setFlights((f) => f.filter((x) => x.id !== id)), [])

    /**
     * Clasifica al momento: la fila se tiñe del color de su lista, sale deslizándose y una ficha vuela a «Biblioteca».
     * `saved`: ya guardado (el diálogo de completar). Si falla, los juegos vuelven a la bandeja.
     */
    function classify(targets: LibraryGame[], status: TrayDestination, saved?: Promise<void>) {
        if (targets.length === 0) return
        const order = new Map(shown.map((g, i) => [g.appid, i]))
        const list = [...targets].sort((a, b) => (order.get(a.appid) ?? 0) - (order.get(b.appid) ?? 0))
        const ids = new Set(list.map((g) => g.appid))
        const action: TrayAction = {
            id: ++seq.current,
            games: list,
            snapshots: list.map(statusSnapshot),
            status,
            write: saved ?? setGamesStatus([...ids], status),
            undone: false,
        }
        lastAction.current = action
        setError('')
        setPreview(null)
        setSelected((s) => new Set([...s].filter((id) => !ids.has(id))))
        setSession((s) => addToSession(s, status, list.length))
        setFresh(status)
        setToast({ id: action.id, name: list.length === 1 ? (list[0].name ?? `App ${list[0].appid}`) : null, count: list.length, status })

        action.write.catch((e: unknown) => {
            if (action.undone) return
            action.undone = true
            setGames((g) => g && [...g.filter((x) => !ids.has(x.appid)), ...list])
            setSession((s) => addToSession(s, status, -list.length))
            setError(e instanceof Error ? e.message : 'No se pudo guardar')
            if (lastAction.current === action) {
                lastAction.current = null
                setToast(null)
            }
        })

        const remove = () => {
            if (action.undone) return
            setGames((g) => g && g.filter((x) => !ids.has(x.appid)))
        }
        if (reduce) {
            remove()
            return
        }
        setGoing((m) => {
            const next = new Map(m)
            list.forEach((g, j) => next.set(g.appid, { status, j }))
            return next
        })
        setTimeout(() => {
            if (action.undone) return
            launchFlight(list[0].appid, status, list.length)
            remove()
        }, TINT_MS)
    }

    /** Deshacer: devuelve los juegos a la bandeja y a su estado anterior (con fecha, nota y reseña). */
    async function undo() {
        const action = lastAction.current
        if (!action || action.undone) return
        action.undone = true
        lastAction.current = null
        setToast(null)
        const ids = new Set(action.games.map((g) => g.appid))
        setGames((g) => g && [...g.filter((x) => !ids.has(x.appid)), ...action.games])
        setSession((s) => addToSession(s, action.status, -action.games.length))
        setFresh(null)
        setGoing((m) => {
            const next = new Map(m)
            ids.forEach((id) => next.delete(id))
            return next
        })
        setBack(ids)
        setTimeout(() => setBack(new Set()), 1200)
        try {
            await action.write.catch(() => undefined)
            await restoreGames(action.snapshots)
        } catch (e) {
            setError(`No se pudo deshacer: ${e instanceof Error ? e.message : 'error al guardar'}`)
        }
    }

    // Ctrl + Z deshace y Esc quita la selección, salvo donde se escribe o con un diálogo abierto.
    const undoRef = useRef(undo)
    useEffect(() => {
        undoRef.current = undo
    })
    useEffect(() => {
        function onKey(e: globalThis.KeyboardEvent) {
            if (e.defaultPrevented || ownsKeys(document.activeElement)) return
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z') {
                if (!lastAction.current) return
                e.preventDefault()
                void undoRef.current()
            } else if (e.key === 'Escape') {
                setSelected((s) => (s.size ? new Set() : s))
            }
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [])

    /** Completar pide nota y fecha (diálogo); el resto de destinos se guarda al momento. */
    function act(game: LibraryGame, status: TrayDestination) {
        setSheetIds(null)
        if (status === 'completado') setQueue([game])
        else classify([game], status)
    }

    function actBatch(targets: LibraryGame[], status: TrayDestination) {
        setSheetIds(null)
        if (status === 'completado') setQueue(targets)
        else classify(targets, status)
    }

    function toggle(appid: number) {
        setSelected((s) => {
            const next = new Set(s)
            if (next.has(appid)) next.delete(appid)
            else next.add(appid)
            return next
        })
    }

    /** Atajos sobre la fila con el foco: 1–9 la clasifican (orden de GAME_STATUSES) y x la selecciona. */
    function onListKey(e: KeyboardEvent<HTMLElement>) {
        if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return
        const row = (e.target as HTMLElement).closest<HTMLElement>('li[data-appid]')
        if (!row || row.classList.contains('is-going')) return
        const game = shown.find((g) => g.appid === Number(row.dataset.appid))
        if (!game) return
        const status = destinationForKey(e.key)
        if (status) {
            e.preventDefault()
            if (status !== 'completado') setFocusIndex(shown.indexOf(game))
            act(game, status)
        } else if (e.key === 'x' || e.key === 'X') {
            e.preventDefault()
            toggle(game.appid)
        }
    }

    /** Vista previa del destino en las filas (ratón o foco en un botón de destino). */
    function previewProps(ids: number[], status: TrayDestination) {
        const on = () => setPreview({ ids, status })
        const off = () => setPreview(null)
        return { onPointerEnter: on, onPointerLeave: off, onFocus: on, onBlur: off }
    }

    if (!games) return <Loader label="Cargando bandeja" />

    const selectedGames = sorted.filter((g) => selected.has(g.appid))
    const allShownSelected = shown.length > 0 && shown.every((g) => selected.has(g.appid))
    const sheetGames = sheetIds ? sorted.filter((g) => sheetIds.includes(g.appid)) : []
    const sheetOne = sheetGames.length === 1 ? sheetGames[0] : null
    const sheetSuggestion = sheetOne ? suggestions.get(sheetOne.appid) : null
    const completing = queue[0] ?? null
    const fade = reduce ? { duration: 0 } : undefined

    return (
        <div className={`biblioteca bandeja${selectedGames.length > 0 ? ' has-batch' : ''}`}>
            <header className="page-head tray-head">
                <div>
                    <Link href="/biblioteca" className="lib-back">
                        <ArrowLeft size={14} aria-hidden /> Biblioteca
                    </Link>
                    <div className="tray-title st-bandeja">
                        <span className="tray-title__icon hg-tint">
                            <Inbox aria-hidden />
                        </span>
                        <h1 className="page-title">Bandeja</h1>
                        <AnimatedCount value={games.length} className="tray-count hg-tint" aria-label={`${games.length} sin clasificar`} />
                    </div>
                    <p className="page-subtitle">
                        {games.length === 0
                            ? 'Nada por clasificar.'
                            : `${games.length} ${games.length === 1 ? 'juego' : 'juegos'} sin clasificar. Un clic, o una tecla, y fuera de la bandeja.`}
                    </p>
                </div>
                {games.length > 0 && <TraySessionBox session={session} fresh={fresh} />}
            </header>

            {error && (
                <p className="alert alert--error" role="alert">
                    {error}
                </p>
            )}

            {games.length === 0 ? (
                <TrayEmpty session={session} onSynced={reload} />
            ) : (
                <>
                    <div className="tray-toolbar">
                        <div className="hg-seg hg-seg--slide hg-seg--scroll" role="group" aria-label="Ordenar">
                            {SORTS.map((s) => (
                                <button
                                    key={s.key}
                                    type="button"
                                    aria-pressed={sort === s.key}
                                    className="hg-seg__opt"
                                    onClick={() => {
                                        setSort(s.key)
                                        setResorted(true)
                                        setVisible(PAGE)
                                    }}
                                >
                                    {sort === s.key && (
                                        <motion.span layoutId={`${segId}-thumb`} className="hg-seg__thumb" transition={{ duration: 0.22, ease: EASE_OUT }} />
                                    )}
                                    <span className="hg-seg__text">
                                        {s.label}
                                        {s.key === 'verguenza' && <span className="hg-seg__count"> {shameCount}</span>}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <label className="tray-check">
                            <input
                                type="checkbox"
                                checked={allShownSelected}
                                onChange={() => setSelected(allShownSelected ? new Set() : new Set(shown.map((g) => g.appid)))}
                            />
                            Seleccionar {shown.length === sorted.length ? 'todos' : 'los visibles'}
                        </label>
                    </div>

                    <div className="tray-hint">
                        <span className="tray-keys" aria-hidden>
                            {TRAY_DESTINATIONS.map((s, i) => {
                                const Icon = LIST_ICONS[s]
                                const groupStart = i > 0 && TRAY_GROUPS.some((g) => g.statuses[0] === s)
                                return (
                                    <span key={s} className="tray-keys__item">
                                        {groupStart && <span className="tray-keys__sep" />}
                                        <span className={`st-${s}`}>
                                            <kbd className="hg-kbd">{i + 1}</kbd>
                                            <Icon />
                                            {STATUS_LABELS[s]}
                                        </span>
                                    </span>
                                )
                            })}
                        </span>
                        <span className="hg-keyhint">
                            <kbd>↑</kbd> <kbd>↓</kbd> o <kbd>j</kbd> <kbd>k</kbd> moverte · <kbd>1</kbd>–<kbd>9</kbd> clasificar · <kbd>x</kbd>{' '}
                            seleccionar · <kbd>Ctrl + Z</kbd> deshacer
                        </span>
                    </div>

                    {sort === 'verguenza' && (
                        <p className="lib-note">
                            {shown.length
                                ? 'La lista de la vergüenza: juegos que tienes y nunca has abierto.'
                                : 'No tienes juegos sin estrenar en la bandeja.'}
                        </p>
                    )}

                    <KeyboardList
                        key={sort}
                        className={`hg-rows tray-list${resorted ? ' is-swap' : ''}`}
                        label="Juegos sin clasificar"
                        onKeyDown={onListKey}
                    >
                        <AnimatePresence initial={false}>
                            {shown.map((game, i) => {
                                const name = game.name ?? `App ${game.appid}`
                                const isSelected = selected.has(game.appid)
                                const sug = suggestions.get(game.appid) ?? null
                                const SugIcon = sug ? LIST_ICONS[sug.status] : null
                                const leaving = going.get(game.appid)
                                const previewing = !leaving && preview?.ids.includes(game.appid) ? preview.status : null
                                const tone = leaving?.status ?? previewing
                                const classes = [
                                    'hg-row tray-row',
                                    tone && `st-${tone}`,
                                    isSelected && 'is-selected',
                                    previewing && 'is-preview',
                                    leaving && 'is-going',
                                    back.has(game.appid) ? 'is-back' : !entered && 'hg-enter',
                                ]
                                return (
                                    <motion.li
                                        key={game.appid}
                                        layout={reduce ? false : 'position'}
                                        transition={{ layout: { duration: 0.24, ease: EASE_OUT } }}
                                        exit={
                                            reduce
                                                ? undefined
                                                : {
                                                      x: -48,
                                                      opacity: 0,
                                                      transition: { duration: 0.24, delay: stagger(leaving?.j ?? 0), ease: [0.4, 0, 0.2, 1] },
                                                  }
                                        }
                                        data-appid={game.appid}
                                        className={classes.filter(Boolean).join(' ')}
                                        style={{ '--i': i } as CSSProperties}
                                    >
                                        <label className="tray-row__select">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggle(game.appid)}
                                                aria-label={`Seleccionar ${name}`}
                                            />
                                        </label>
                                        <span className="hg-row__cover">
                                            <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="header" sizes="112px" />
                                        </span>
                                        <span className="hg-row__main">
                                            <span className="tray-name">
                                                <Link href={`/juego/${game.appid}`} className="hg-row__link" data-row-link>
                                                    {name}
                                                </Link>
                                                {tone && <DestChip status={tone} />}
                                            </span>
                                            <RowMeta game={game} />
                                        </span>

                                        {/* Escritorio: los nueve destinos a la vista, en tres grupos */}
                                        <span className="tray-acts" role="group" aria-label={`Clasificar ${name}`}>
                                            {TRAY_GROUPS.map((group, gi) => (
                                                <span key={group.title} className="tray-acts__group">
                                                    {gi > 0 && <span className="tray-acts__sep" aria-hidden />}
                                                    {group.statuses.map((s) => {
                                                        const Icon = LIST_ICONS[s]
                                                        const n = destinationKey(s)
                                                        const isSug = sug?.status === s
                                                        return (
                                                            <button
                                                                key={s}
                                                                type="button"
                                                                className={`tray-act st-${s}${isSug ? ' is-sug' : ''}`}
                                                                aria-label={`${STATUS_LABELS[s]}${isSug ? ' (sugerido)' : ''}`}
                                                                title={`${STATUS_LABELS[s]} (${n})${isSug ? ` · sugerido: ${sug.reason.toLowerCase()}` : ''}`}
                                                                aria-keyshortcuts={String(n)}
                                                                onClick={() => act(game, s)}
                                                                {...previewProps([game.appid], s)}
                                                            >
                                                                <Icon aria-hidden />
                                                                <span className="tray-act__key" aria-hidden>
                                                                    {n}
                                                                </span>
                                                            </button>
                                                        )
                                                    })}
                                                </span>
                                            ))}
                                        </span>

                                        {/* Móvil: el sugerido a un toque y «Clasificar» abre la hoja con los nueve */}
                                        <span className="tray-macts">
                                            {sug && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    className={`tray-sugbtn hg-tint st-${sug.status}`}
                                                    title={`Sugerido: ${sug.reason.toLowerCase()}`}
                                                    onClick={() => act(game, sug.status)}
                                                >
                                                    {SugIcon && <SugIcon aria-hidden />}
                                                    {STATUS_LABELS[sug.status]}
                                                </Button>
                                            )}
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="secondary"
                                                className="tray-open"
                                                aria-haspopup="dialog"
                                                onClick={() => setSheetIds([game.appid])}
                                            >
                                                Clasificar <ChevronDown aria-hidden />
                                            </Button>
                                        </span>
                                    </motion.li>
                                )
                            })}
                        </AnimatePresence>
                    </KeyboardList>

                    {sorted.length > visible && (
                        <div className="lib-more">
                            <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE)}>
                                Mostrar más ({sorted.length - visible})
                            </Button>
                        </div>
                    )}
                </>
            )}

            <div className="tray-float">
                <AnimatePresence>
                    {toast && (
                        <motion.div
                            key={toast.id}
                            className="tray-float__toast"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0, transition: fade ?? { duration: 0.22, ease: EASE_OUT } }}
                            exit={{ opacity: 0, y: 8, transition: fade ?? { duration: 0.16, ease: 'easeIn' } }}
                        >
                            <TrayToast toast={toast} onUndo={() => void undo()} />
                        </motion.div>
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {selectedGames.length > 0 && (
                        <motion.div
                            key="batch"
                            className="tray-batch"
                            role="region"
                            aria-label="Clasificar los seleccionados"
                            initial={{ opacity: 0, y: 'calc(100% + 24px)' }}
                            animate={{ opacity: 1, y: 0, transition: fade ?? { duration: 0.28, ease: EASE_OUT } }}
                            exit={{ opacity: 0, y: 'calc(100% + 24px)', transition: fade ?? { duration: 0.18, ease: 'easeIn' } }}
                        >
                            <span className="tray-batch__count">
                                <AnimatedCount value={selectedGames.length} className="tray-batch__n" />
                                {selectedGames.length === 1 ? 'seleccionado' : 'seleccionados'}
                            </span>
                            <span className="tray-batch__sep" aria-hidden />
                            <span className="tray-batch__actions">
                                {TRAY_GROUPS.map((group, gi) => (
                                    <span key={group.title} className="tray-acts__group">
                                        {gi > 0 && <span className="tray-batch__sep" aria-hidden />}
                                        {group.statuses.map((s) => {
                                            const Icon = LIST_ICONS[s]
                                            return (
                                                <Button
                                                    key={s}
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    className={`tray-bact st-${s}`}
                                                    title={STATUS_LABELS[s]}
                                                    aria-label={STATUS_LABELS[s]}
                                                    onClick={() => actBatch(selectedGames, s)}
                                                    {...previewProps(
                                                        selectedGames.map((g) => g.appid),
                                                        s,
                                                    )}
                                                >
                                                    <Icon aria-hidden />
                                                    <span className="tray-bact__label">{STATUS_LABELS[s]}</span>
                                                </Button>
                                            )
                                        })}
                                    </span>
                                ))}
                            </span>
                            <Button
                                type="button"
                                className="tray-batch__open"
                                aria-haspopup="dialog"
                                onClick={() => setSheetIds(selectedGames.map((g) => g.appid))}
                            >
                                Clasificar {selectedGames.length} <ChevronDown aria-hidden />
                            </Button>
                            <span className="tray-batch__sep tray-batch__sep--end" aria-hidden />
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="tray-batch__x"
                                aria-label="Quitar la selección"
                                title="Quitar la selección (Esc)"
                                onClick={() => setSelected(new Set())}
                            >
                                <X aria-hidden />
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {flights.map((f) => (
                <TrayFly key={f.id} flight={f} onDone={endFlight} />
            ))}

            {/* Hoja inferior (móvil): los nueve destinos de un juego o de los seleccionados */}
            <Sheet open={sheetIds !== null && sheetGames.length > 0} onOpenChange={(open) => !open && setSheetIds(null)}>
                <SheetContent
                    side="bottom"
                    className="tray-sheet"
                    aria-describedby={undefined}
                    onKeyDown={(e) => {
                        const status = destinationForKey(e.key)
                        if (!status) return
                        e.preventDefault()
                        actBatch(sheetGames, status)
                    }}
                >
                    <span className="tray-sheet__handle" aria-hidden />
                    {sheetOne ? (
                        <div className="tray-sheet__head">
                            <span className="hg-row__cover">
                                <GameCover appid={sheetOne.appid} name={sheetOne.name} headerImage={sheetOne.header_image} variant="header" sizes="72px" />
                            </span>
                            <div>
                                <SheetTitle className="tray-sheet__title">{sheetOne.name ?? `App ${sheetOne.appid}`}</SheetTitle>
                                <span>
                                    {sheetOne.playtime_forever ? `${formatHours(sheetOne.playtime_forever)} jugadas` : 'Sin estrenar'}
                                    {sheetOne.hltb_main ? ` · ${formatHours(sheetOne.hltb_main)} de historia` : ''}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="tray-sheet__head is-batch">
                            <div>
                                <SheetTitle className="tray-sheet__title">Clasificar {sheetGames.length} juegos</SheetTitle>
                                <span>{sheetGames.map((g) => g.name ?? `App ${g.appid}`).join(', ')}</span>
                            </div>
                        </div>
                    )}
                    {sheetSuggestion && (
                        <p className="tray-sheet__sug">
                            Sugerido: <StatusChip status={sheetSuggestion.status} /> <span>{sheetSuggestion.reason.toLowerCase()}</span>
                        </p>
                    )}
                    {TRAY_GROUPS.map((group) => (
                        <div key={group.title}>
                            <p className="tray-sheet__g">{group.title}</p>
                            <div className="tray-sheet__grid">
                                {group.statuses.map((s) => {
                                    const Icon = LIST_ICONS[s]
                                    const isSug = sheetSuggestion?.status === s
                                    return (
                                        <button
                                            key={s}
                                            type="button"
                                            className={`tray-sopt st-${s}${isSug ? ' is-sug' : ''}`}
                                            onClick={() => actBatch(sheetGames, s)}
                                        >
                                            <span className="tray-sopt__icon hg-tint">
                                                <Icon aria-hidden />
                                            </span>
                                            {STATUS_LABELS[s]}
                                            {isSug && <span className="tray-sopt__sug">Sugerido</span>}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                    <Button type="button" variant="secondary" className="tray-sheet__cancel" onClick={() => setSheetIds(null)}>
                        Cancelar
                    </Button>
                </SheetContent>
            </Sheet>

            <CompleteDialog
                game={completing}
                onOpenChange={(open) => !open && setQueue([])}
                onSaved={(appid) => {
                    const game = queue.find((g) => g.appid === appid)
                    const index = shown.findIndex((g) => g.appid === appid)
                    setQueue((q) => q.filter((g) => g.appid !== appid))
                    if (game) classify([game], 'completado', Promise.resolve())
                    if (index !== -1 && queue.length <= 1) setFocusIndex(index)
                }}
            />
        </div>
    )
}

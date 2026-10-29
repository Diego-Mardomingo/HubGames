'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Bell, CalendarDays, Heart, Percent, Search, TrendingDown, Undo2 } from 'lucide-react'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import { formatPrice, removeFromWishlist, restoreToWishlist, type WishlistGame } from '@/lib/wishlist'
import {
    WISHLIST_FILTERS,
    WISHLIST_FILTER_LABELS,
    WISHLIST_SORTS,
    WISHLIST_SORT_LABELS,
    closestToLow,
    matchesWishlistFilter,
    restoreAt,
    sortWishlist,
    wishlistCounts,
    type WishlistFilter,
    type WishlistSort,
} from '@/lib/wishlist-list'
import { priceRule } from '@/lib/scores'
import { WISHLIST_CHANGED_EVENT } from '@/lib/nav-status'
import type { AlertMode, PriceAlert } from '@/lib/price-alerts'
import type { GameStatus } from '@/lib/tracker'
import { Button } from '@/components/ui/button'
import { Skeleton, SkeletonZone } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import KeyboardList from '@/components/KeyboardList'
import Segmented from '@/components/Segmented'
import AnimatedCount from '@/components/AnimatedCount'
import { openGameSearch } from '@/components/tracker/GameSearch'
import SyncButton from '@/components/dashboard/SyncButton'
import WishlistRow, { type LibraryEntry } from '@/components/wishlist/WishlistRow'
import '../biblioteca/biblioteca.css'
import '@/components/wishlist/wishlist.css'

const PAGE = 50
const DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const EASE_OUT = [0.22, 1, 0.36, 1] as const
/** Con más filas, al ordenar solo hay fundido (como en los logros de un juego). */
const LAYOUT_LIMIT = 150
/** Entrada de la página: lo que tarda la última animación (destello del mínimo de la 8.ª fila). */
const ENTRY_MS = 2200
/** Quitar: la fila se desliza y se apaga (200 ms) y luego se cierra el hueco (240 ms). */
const LEAVE_MS = 200
const COLLAPSE_MS = 250
const UNDO_MS = 5000

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>

const FILTER_ICONS: Partial<Record<WishlistFilter, React.ReactNode>> = {
    minimo: <TrendingDown className="wl-f-ic is-deal" aria-hidden />,
    oferta: <Percent className="wl-f-ic sc-top" aria-hidden />,
    aviso: <Bell className="wl-f-ic st-todos" aria-hidden />,
    pronto: <CalendarDays className="wl-f-ic" aria-hidden />,
}

/** Color del contador de cada filtro (el de «En mínimo histórico», amarillo sólido si hay alguno). */
function countClass(f: WishlistFilter, n: number): string {
    const tone = f === 'minimo' ? (n ? 'is-deal' : '') : f === 'oferta' ? 'hg-tint sc-top' : f === 'aviso' ? 'hg-tint st-todos' : ''
    return ['wl-cnt', tone, n ? '' : 'is-zero'].filter(Boolean).join(' ')
}

async function loadWishlist(): Promise<WishlistGame[]> {
    const out: WishlistGame[] = []
    for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('hubgames_wishlist').select('*').order('appid').range(from, from + 999)
        if (error) throw new Error(error.message)
        out.push(...(data as WishlistGame[]))
        if (data.length < 1000) return out
    }
}

/** Criterio de aviso de precio (#37) de cada juego que lo tiene; el resto avisa en el mínimo histórico. */
async function loadAlerts(): Promise<Map<number, PriceAlert>> {
    const { data, error } = await supabase.from('hubgames_price_alerts').select('appid, mode, target_price, target_discount, last_notified_price')
    if (error) throw new Error(error.message)
    return new Map(data.map((a) => [a.appid, { ...a, mode: a.mode as AlertMode }]))
}

/** Juegos de la wishlist que también están en tu Biblioteca (pendientes sin comprar): solo esos appid. */
async function loadLibrary(appids: number[]): Promise<Map<number, LibraryEntry>> {
    const out = new Map<number, LibraryEntry>()
    for (let i = 0; i < appids.length; i += 300) {
        const { data, error } = await supabase
            .from('hubgames_library')
            .select('appid, status, favorite, endless')
            .in('appid', appids.slice(i, i + 300))
        if (error) throw new Error(error.message)
        for (const r of data) {
            if (r.appid !== null && r.status) {
                out.set(r.appid, { status: r.status as GameStatus, favorite: !!r.favorite, endless: !!r.endless })
            }
        }
    }
    return out
}

interface Removal {
    id: number
    game: WishlistGame
    /** Posición en la lista completa, para devolverlo a su sitio. */
    index: number
    done: Promise<void>
}

/** Fila de esqueleto con la forma de la de verdad (cápsula, nombre y datos, precio y regla). */
function SkeletonRows() {
    return (
        <ul className="wl-list" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="wl-skel-row">
                    <Skeleton className="wl-skel-row__cover" />
                    <span className="wl-skel-row__lines">
                        <Skeleton h={14} w="70%" />
                        <Skeleton h={11} w="45%" />
                    </span>
                    <span className="wl-skel-row__price">
                        <Skeleton h={14} w="60%" />
                        <Skeleton h={6} w="100%" />
                    </span>
                </li>
            ))}
        </ul>
    )
}

/** Wishlist (#35): juegos que aún no tienes, con su nota, su duración, el precio de Steam y lo cerca que está de su mínimo (#36). */
export default function WishlistPage() {
    const router = useRouter()
    const reduce = useReducedMotion() ?? false
    const [games, setGames] = useState<WishlistGame[] | null>(null)
    const [alerts, setAlerts] = useState<Map<number, PriceAlert>>(new Map())
    const [library, setLibrary] = useState<Map<number, LibraryEntry>>(new Map())
    const [sort, setSort] = useState<WishlistSort>('descuento')
    const [filter, setFilter] = useState<WishlistFilter>('todos')
    const [visible, setVisible] = useState(PAGE)
    const [error, setError] = useState('')
    const [userId, setUserId] = useState<string | null>(null)
    // Entrada de la página (filas escalonadas, destello del mínimo, regla): solo al llegar, no al filtrar.
    const [entering, setEntering] = useState(false)
    // Quitar: la fila sale ('out') y se pliega ('collapse') antes de irse de la lista.
    const [leaving, setLeaving] = useState<Map<number, 'out' | 'collapse'>>(new Map())
    const [toast, setToast] = useState<Removal | null>(null)
    const [back, setBack] = useState<number | null>(null)
    const [freshAlert, setFreshAlert] = useState<number | null>(null)
    const timers = useRef(new Map<number, ReturnType<typeof setTimeout>[]>())
    const toastId = useRef(0)

    useEffect(() => {
        let cancelled = false
        safeGetSession().then(({ data: { session } }) => {
            if (!session) {
                router.push('/login')
                return
            }
            setUserId(session.user.id)
            loadAlerts()
                .then((a) => !cancelled && setAlerts(a))
                .catch(() => {})
            loadWishlist()
                .then((list) => {
                    if (cancelled) return
                    setGames(list)
                    setEntering(true)
                    loadLibrary(list.map((g) => g.appid))
                        .then((l) => !cancelled && setLibrary(l))
                        .catch(() => {})
                })
                .catch((e: Error) => {
                    if (cancelled) return
                    setError(e.message)
                    setGames([])
                })
        })
        return () => {
            cancelled = true
        }
    }, [router])

    useEffect(() => {
        if (!entering) return
        const t = setTimeout(() => setEntering(false), ENTRY_MS)
        return () => clearTimeout(t)
    }, [entering])

    // El aviso de Deshacer dura 5 s.
    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast((cur) => (cur?.id === toast.id ? null : cur)), UNDO_MS)
        return () => clearTimeout(t)
    }, [toast])

    // Lo devuelto con Deshacer: a la vista, con el cursor de selección que se apaga.
    useEffect(() => {
        if (back === null) return
        document.querySelector(`[data-appid="${back}"]`)?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
        const t = setTimeout(() => setBack(null), 1300)
        return () => clearTimeout(t)
    }, [back, reduce])

    useEffect(() => {
        if (freshAlert === null) return
        const t = setTimeout(() => setFreshAlert(null), 800)
        return () => clearTimeout(t)
    }, [freshAlert])

    useEffect(() => {
        const all = timers.current
        return () => all.forEach((ts) => ts.forEach(clearTimeout))
    }, [])

    const all = useMemo(() => games ?? [], [games])
    const counts = useMemo(() => wishlistCounts(all, alerts), [all, alerts])
    const list = useMemo(
        () => sortWishlist(all.filter((g) => matchesWishlistFilter(g, filter, alerts.get(g.appid) ?? null)), sort),
        [all, alerts, filter, sort],
    )
    const lastSync = useMemo(
        () => all.reduce<string | null>((max, g) => (g.price_synced_at && (!max || g.price_synced_at > max) ? g.price_synced_at : max), null),
        [all],
    )

    const dropTimers = useCallback((appid: number) => {
        timers.current.get(appid)?.forEach(clearTimeout)
        timers.current.delete(appid)
    }, [])

    function remove(game: WishlistGame) {
        const index = all.findIndex((g) => g.appid === game.appid)
        if (index < 0) return
        setError('')
        const done = removeFromWishlist(game.appid).then(
            () => {
                window.dispatchEvent(new Event(WISHLIST_CHANGED_EVENT))
            },
            (e: unknown) => {
                // No se ha quitado: vuelve a su sitio y se cierra el aviso.
                dropTimers(game.appid)
                setLeaving((m) => {
                    const next = new Map(m)
                    next.delete(game.appid)
                    return next
                })
                setGames((gs) => (gs ? restoreAt(gs, game, index) : gs))
                setToast((cur) => (cur?.game.appid === game.appid ? null : cur))
                setError(e instanceof Error ? e.message : 'No se pudo quitar')
                throw e
            },
        )
        done.catch(() => {})
        setToast({ id: ++toastId.current, game, index, done })

        const drop = () => {
            timers.current.delete(game.appid)
            setLeaving((m) => {
                const next = new Map(m)
                next.delete(game.appid)
                return next
            })
            setGames((gs) => gs?.filter((g) => g.appid !== game.appid) ?? gs)
        }
        if (reduce) return drop()
        dropTimers(game.appid)
        setLeaving((m) => new Map(m).set(game.appid, 'out'))
        timers.current.set(game.appid, [
            setTimeout(() => setLeaving((m) => new Map(m).set(game.appid, 'collapse')), LEAVE_MS),
            setTimeout(drop, LEAVE_MS + COLLAPSE_MS),
        ])
    }

    async function undo() {
        const action = toast
        if (!action) return
        setToast(null)
        try {
            await action.done
        } catch {
            return // No llegó a quitarse.
        }
        dropTimers(action.game.appid)
        setLeaving((m) => {
            const next = new Map(m)
            next.delete(action.game.appid)
            return next
        })
        setGames((gs) => (gs ? restoreAt(gs, action.game, action.index) : gs))
        setBack(action.game.appid)
        try {
            await restoreToWishlist(action.game.appid, action.game.date_added)
            window.dispatchEvent(new Event(WISHLIST_CHANGED_EVENT))
        } catch (e) {
            setGames((gs) => gs?.filter((g) => g.appid !== action.game.appid) ?? gs)
            setError(e instanceof Error ? e.message : 'No se pudo deshacer')
        }
    }

    function pickFilter(f: WishlistFilter) {
        setFilter(f)
        setVisible(PAGE)
    }

    const loading = games === null
    const shown = list.slice(0, visible)
    const animateLayout = !reduce && !entering && shown.length <= LAYOUT_LIMIT

    return (
        <div className={`biblioteca wl${entering ? ' is-entering' : ''}`}>
            <header className="page-head">
                <div>
                    <h1 className="page-title">Wishlist</h1>
                    <p className="page-subtitle">
                        {loading ? (
                            'Cargando tu wishlist…'
                        ) : counts.todos === 0 ? (
                            'Aún no hay juegos.'
                        ) : (
                            <>
                                {counts.todos} {counts.todos === 1 ? 'juego' : 'juegos'}
                                {counts.minimo > 0 && (
                                    <>
                                        {' · '}
                                        <b>{counts.minimo} en mínimo histórico</b>
                                    </>
                                )}
                                {counts.oferta > 0 && ` · ${counts.oferta} en oferta`}.
                                {lastSync && ` Precios del ${DATE.format(new Date(lastSync)).replace('.', '')}.`}
                            </>
                        )}
                    </p>
                </div>
                <div className="lib-head-actions">
                    <Button variant="secondary" onClick={openGameSearch}>
                        <Search aria-hidden /> Añadir un juego
                    </Button>
                </div>
            </header>

            {error && (
                <p className="alert alert--error" role="alert">
                    {error}
                </p>
            )}

            {loading ? (
                <SkeletonZone label="Cargando tu wishlist" className="wl-loading">
                    <div className="wish-toolbar" aria-hidden>
                        <Skeleton className="wl-loading__bar" />
                    </div>
                    <SkeletonRows />
                </SkeletonZone>
            ) : (
                counts.todos > 0 && (
                    <div className="wish-toolbar">
                        <Segmented
                            aria-label="Filtrar"
                            className="wl-filters"
                            value={filter}
                            options={WISHLIST_FILTERS}
                            labels={WISHLIST_FILTER_LABELS}
                            icons={FILTER_ICONS}
                            counts={counts}
                            countClassName={countClass}
                            onChange={pickFilter}
                            scroll
                        />
                        <label className="wl-sort">
                            <span>Ordenar</span>
                            <Select value={sort} onValueChange={(v) => setSort(v as WishlistSort)}>
                                <SelectTrigger className="lib-select" aria-label="Ordenar">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {WISHLIST_SORTS.map((s) => (
                                        <SelectItem key={s} value={s}>
                                            {WISHLIST_SORT_LABELS[s]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </label>
                    </div>
                )
            )}

            {!loading &&
                (list.length === 0 ? (
                    <Empty
                        key={filter}
                        filter={filter}
                        games={all}
                        total={counts.todos}
                        onAll={() => pickFilter('todos')}
                        onSynced={() => void loadWishlist().then(setGames, () => {})}
                    />
                ) : (
                    <KeyboardList key={filter} className="wl-list wl-swap" label="Juegos de tu wishlist">
                        {shown.map((game, i) => {
                            const state = leaving.get(game.appid)
                            return (
                                <motion.li
                                    key={game.appid}
                                    data-appid={game.appid}
                                    layout={animateLayout && !state ? 'position' : false}
                                    transition={{ layout: { duration: 0.32, ease: EASE_OUT } }}
                                    className={[
                                        'wl-item',
                                        state === 'out' && 'is-leaving',
                                        state === 'collapse' && 'is-leaving is-collapsing',
                                        back === game.appid && 'is-back',
                                    ]
                                        .filter(Boolean)
                                        .join(' ')}
                                    style={{ '--i': i } as CSSVars}
                                >
                                    <WishlistRow
                                        game={game}
                                        priority={i < 6}
                                        userId={userId}
                                        alert={alerts.get(game.appid) ?? null}
                                        library={library.get(game.appid) ?? null}
                                        freshAlert={freshAlert === game.appid}
                                        onAlertSaved={(a) => {
                                            setAlerts((m) => new Map(m).set(game.appid, a))
                                            setFreshAlert(game.appid)
                                        }}
                                        onRemove={() => remove(game)}
                                    />
                                </motion.li>
                            )
                        })}
                    </KeyboardList>
                ))}

            {list.length > visible && (
                <div className="lib-more">
                    <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE)}>
                        Mostrar más ({list.length - visible})
                    </Button>
                </div>
            )}

            {!loading && counts.todos > 0 && (
                <p className="wish-attribution">
                    Precios de la tienda de Steam (España). Mínimos históricos de{' '}
                    <a href="https://isthereanydeal.com/" target="_blank" rel="noreferrer">
                        IsThereAnyDeal
                    </a>
                    .
                </p>
            )}

            <div className="tray-float">
                <AnimatePresence>
                    {toast && (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.22, ease: EASE_OUT } }}
                            exit={{ opacity: 0, y: 8, transition: { duration: reduce ? 0 : 0.16, ease: 'easeIn' } }}
                        >
                            <div className="tray-toast" role="status">
                                <span className="tray-toast__text">
                                    Quitado de la wishlist: <b>{toast.game.name ?? `App ${toast.game.appid}`}</b>
                                </span>
                                <Button type="button" size="sm" variant="ghost" onClick={() => void undo()}>
                                    <Undo2 aria-hidden /> Deshacer
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

/** Wishlist vacía (cómo se llena y dos acciones) o filtro sin resultados (qué pasa y «Ver todos»). */
function Empty({
    filter,
    games,
    total,
    onAll,
    onSynced,
}: {
    filter: WishlistFilter
    games: WishlistGame[]
    total: number
    onAll: () => void
    onSynced: () => void
}) {
    if (total === 0) {
        return (
            <div className="wl-empty">
                <span className="wl-empty__ic" aria-hidden>
                    <Heart />
                </span>
                <p>
                    <b>Tu wishlist está vacía</b>
                    Se importa sola de tu wishlist de Steam cada día (con el perfil público) y también puedes añadir juegos desde el
                    buscador o la ficha de un juego.
                </p>
                <div className="wl-empty__acts">
                    <Button variant="secondary" onClick={openGameSearch}>
                        <Search aria-hidden /> Buscar un juego
                    </Button>
                    <SyncButton label="Sincronizar con Steam" variant="secondary" onSynced={onSynced} />
                </div>
            </div>
        )
    }
    const near = filter === 'minimo' ? closestToLow(games) : null
    const nearRule = near ? priceRule(near) : null
    const msg: Record<Exclude<WishlistFilter, 'todos'>, [string, string]> = {
        minimo: [
            'Ninguno en su mínimo histórico hoy',
            near && nearRule
                ? `El más cerca es ${near.name ?? `App ${near.appid}`}: ${formatPrice(near.price_final)}, ha llegado a ${formatPrice(nearRule.floor)}. Te avisamos cuando alguno llegue.`
                : 'Te avisamos cuando alguno llegue.',
        ],
        oferta: ['Ninguno en oferta ahora mismo', 'Steam suele hacer rebajas grandes en otoño e invierno.'],
        aviso: [
            'Ningún juego con aviso propio',
            'Por defecto te avisamos cuando un juego llega a su mínimo histórico. Pulsa la campana de un juego para poner un precio o un descuento.',
        ],
        pronto: ['Ningún juego por salir', 'Aquí salen los que aún no tienen precio en Steam.'],
    }
    if (filter === 'todos') return null
    const [title, text] = msg[filter]
    return (
        <div className="wl-empty wl-swap">
            <span className={`wl-empty__ic${filter === 'minimo' ? ' is-deal' : ''}`} aria-hidden>
                {FILTER_ICONS[filter]}
            </span>
            <p>
                <b>{title}</b>
                {text}
            </p>
            <div className="wl-empty__acts">
                <Button variant="secondary" onClick={onAll}>
                    Ver todos (<AnimatedCount value={total} />)
                </Button>
            </div>
        </div>
    )
}

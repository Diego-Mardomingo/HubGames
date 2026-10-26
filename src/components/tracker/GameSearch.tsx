'use client'

import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    AlertTriangle,
    BookmarkPlus,
    Check,
    Clock,
    ExternalLink,
    Heart,
    History,
    Loader2,
    RefreshCw,
    Search,
    SearchX,
    ShoppingCart,
    Star,
    ThumbsUp,
    TrendingDown,
    Trophy,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { addToPending, formatHours, setGamesStatus, type GameStatus } from '@/lib/tracker'
import { addToWishlist } from '@/lib/wishlist'
import { metacriticScore, ratingTier, steamReviewScore } from '@/lib/scores'
import {
    addRecent,
    canWishlist,
    matchRange,
    parseRecent,
    pendingAction,
    RECENT_KEY,
    searchPrice,
    type KnownPrice,
    type RecentGame,
    type SteamSearchResult,
} from '@/lib/game-search'
import type { WishlistDeal } from '@/lib/nav-status'
import type { PriceData } from '@/components/wishlist/PriceInfo'
import { PriceTag } from '@/components/wishlist/PriceInfo'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useSearchShortcut } from './SearchShortcut'
import { MarkFlags, StatusChip } from './status'
import './tracker.css'

const DEBOUNCE_MS = 250
/** Antes de escribir: los 3 últimos que abriste o añadiste y, debajo, los de tu wishlist en mínimo histórico. */
const RECENT_SHOWN = 3
const DEALS_SHOWN = 5
/** Curva y duración del resaltado que se desliza entre resultados (--ease-out de globals.css). */
const CURSOR_TRANSITION = { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const }

/** Abre el buscador desde cualquier sitio (botones de la nav y de la biblioteca). */
export const OPEN_SEARCH_EVENT = 'hubgames:open-search'

export function openGameSearch() {
    window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))
}

/**
 * Buscador de juegos de Steam (#20), con Ctrl + K (o ⌘ + K). Cada resultado dice dónde está ese juego para ti (lista,
 * marcas, horas, «Sin comprar»), con sus puntuaciones y su precio; se manda a Pendientes o a la wishlist sin salir de aquí.
 * `deals`: juegos de tu wishlist en mínimo histórico, los mismos del indicador de la navegación (sin consulta propia).
 */
export default function GameSearch({ deals = [] }: { deals?: WishlistDeal[] }) {
    const [open, setOpen] = useState(false)

    useEffect(() => {
        const onKey = (e: globalThis.KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                setOpen((o) => !o)
            }
        }
        const onOpen = () => setOpen(true)
        window.addEventListener('keydown', onKey)
        window.addEventListener(OPEN_SEARCH_EVENT, onOpen)
        return () => {
            window.removeEventListener('keydown', onKey)
            window.removeEventListener(OPEN_SEARCH_EVENT, onOpen)
        }
    }, [])

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="game-search" aria-describedby={undefined}>
                <DialogTitle className="sr-only">Buscar un juego de Steam</DialogTitle>
                {/* El contenido se monta al abrir (y se desmonta tras la animación de cierre): cada apertura empieza vacía. */}
                <SearchBody deals={deals} onNavigate={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    )
}

// ── Datos de lo que ya sigues ──

/** Lo que sabemos de un juego que sigues (vista hubgames_library). */
interface Tracked {
    status: GameStatus
    favorite: boolean
    endless: boolean
    owned: boolean
    rating: number | null
    playtime: number
    unlocked: number | null
    total: number | null
    reviews: number | null
    metacritic: number | null
    price: KnownPrice | null
}

/** Lo que sabemos de un juego de tu wishlist (vista hubgames_wishlist). */
interface Wished {
    reviews: number | null
    price: KnownPrice | null
}

const PRICE_COLUMNS = 'price_initial, price_final, discount_percent, itad_id, steam_low, steam_low_at, all_low, all_low_shop, all_low_at'

type PriceRow = { [K in keyof KnownPrice]: KnownPrice[K] | null }

function knownPrice(row: PriceRow): KnownPrice | null {
    if (row.price_final === null) return null
    return {
        price_initial: row.price_initial,
        price_final: row.price_final,
        discount_percent: row.discount_percent,
        itad_id: row.itad_id,
        steam_low: row.steam_low,
        steam_low_at: row.steam_low_at,
        all_low: row.all_low,
        all_low_shop: row.all_low_shop,
        all_low_at: row.all_low_at,
    }
}

/** Dos consultas, como antes, pero a las vistas: así llegan marcas, horas, reseñas y el mínimo histórico. */
async function loadMarks(ids: number[]): Promise<{ tracked: Map<number, Tracked>; wished: Map<number, Wished> }> {
    if (ids.length === 0) return { tracked: new Map(), wished: new Map() }
    const [{ data: lib }, { data: wish }] = await Promise.all([
        supabase
            .from('hubgames_library')
            .select(
                `appid, status, favorite, endless, owned, rating, playtime_forever, achievements_unlocked, achievements_total, steamspy_userscore, metacritic_score, ${PRICE_COLUMNS}`
            )
            .in('appid', ids),
        supabase.from('hubgames_wishlist').select(`appid, steamspy_userscore, ${PRICE_COLUMNS}`).in('appid', ids),
    ])
    const tracked = new Map<number, Tracked>()
    for (const r of lib ?? []) {
        if (r.appid === null || !r.status) continue
        tracked.set(r.appid, {
            status: r.status as GameStatus,
            favorite: r.favorite === true,
            endless: r.endless === true,
            owned: r.owned !== false,
            rating: r.rating,
            playtime: r.playtime_forever ?? 0,
            unlocked: r.achievements_unlocked,
            total: r.achievements_total,
            reviews: r.steamspy_userscore,
            metacritic: r.metacritic_score,
            price: knownPrice(r),
        })
    }
    const wished = new Map<number, Wished>()
    for (const r of wish ?? []) {
        if (r.appid === null) continue
        wished.set(r.appid, { reviews: r.steamspy_userscore, price: knownPrice(r) })
    }
    return { tracked, wished }
}

function loadRecent(): RecentGame[] {
    try {
        return parseRecent(localStorage.getItem(RECENT_KEY))
    } catch {
        return []
    }
}

function saveRecent(list: RecentGame[]) {
    try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(list))
    } catch {
        // Sin localStorage (modo privado estricto): el buscador funciona igual, sin recientes.
    }
}

// ── Cuerpo del diálogo ──

/** Un resultado, un reciente o un juego en mínimo: lo que hace falta para pintar la fila. */
interface Item {
    appid: number
    name: string
    image: string | null
    /** Resultado de la tienda (precio de hoy y Metacritic); no lo hay en recientes ni en mínimos. */
    hit?: SteamSearchResult
    /** Precio de los juegos en mínimo (ya viene de la navegación). */
    price?: PriceData
    /** Reseñas de Steam de los juegos en mínimo. */
    reviews?: number | null
    group?: 'recent' | 'deal'
}

type Added = { pend?: true; wish?: true }

function SearchBody({ deals, onNavigate }: { deals: WishlistDeal[]; onNavigate: () => void }) {
    const router = useRouter()
    const shortcut = useSearchShortcut()
    const [term, setTerm] = useState('')
    const [results, setResults] = useState<SteamSearchResult[]>([])
    /** Término de los resultados que se ven: si no coincide con lo escrito, están desfasados (se atenúan). */
    const [resultsTerm, setResultsTerm] = useState('')
    /** Cambia con cada conjunto nuevo de resultados: vuelve a montar la lista (entrada escalonada) y el resaltado. */
    const [version, setVersion] = useState(0)
    const [tracked, setTracked] = useState<Map<number, Tracked>>(new Map())
    const [wished, setWished] = useState<Map<number, Wished>>(new Map())
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [attempt, setAttempt] = useState(0)
    const [active, setActive] = useState(0)
    const [recent, setRecent] = useState<RecentGame[]>(loadRecent)
    /** Resultado y acción guardándose: solo ese botón enseña el spinner. */
    const [saving, setSaving] = useState<{ appid: number; to: 'pend' | 'wish' } | null>(null)
    /** Lo añadido en esta apertura: solo esas filas animan la confirmación. */
    const [added, setAdded] = useState<Map<number, Added>>(new Map())
    const [rowError, setRowError] = useState<Map<number, string>>(new Map())

    const q = term.trim()
    const typing = q.length >= 2

    // Antes de escribir: 3 recientes y los de tu wishlist en mínimo histórico que no estén ya entre ellos.
    const idle = useMemo<Item[]>(() => {
        const rec: Item[] = recent.slice(0, RECENT_SHOWN).map((g) => ({ ...g, group: 'recent' }))
        const dealItems: Item[] = deals
            .filter((d) => !rec.some((r) => r.appid === d.appid))
            .slice(0, DEALS_SHOWN)
            .map((d) => ({ appid: d.appid, name: d.name ?? `App ${d.appid}`, image: d.header_image, price: d, reviews: d.steamspy_userscore, group: 'deal' }))
        return [...rec, ...dealItems]
    }, [recent, deals])

    // Al abrir, la lista de los recientes y los mínimos (sus marcas, horas y precio de hoy).
    useEffect(() => {
        const ids = idle.map((i) => i.appid)
        if (ids.length === 0) return
        let cancelled = false
        loadMarks(ids).then((m) => {
            if (cancelled) return
            setTracked((prev) => new Map([...prev, ...m.tracked]))
            setWished((prev) => new Map([...prev, ...m.wished]))
        })
        return () => {
            cancelled = true
        }
        // Solo al abrir: lo que se añade después ya actualiza las marcas a mano.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (!typing) return
        const controller = new AbortController()
        const timer = setTimeout(async () => {
            setLoading(true)
            setError('')
            try {
                const res = await fetch(`/api/steam/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
                const body = await res.json()
                if (!res.ok) throw new Error(body.error ?? 'No se pudo buscar')
                const found: SteamSearchResult[] = body.results
                const m = await loadMarks(found.map((r) => r.appid))
                if (controller.signal.aborted) return
                setTracked((prev) => new Map([...prev, ...m.tracked]))
                setWished((prev) => new Map([...prev, ...m.wished]))
                setResults(found)
                setResultsTerm(q)
                setVersion((v) => v + 1)
                setActive(0)
            } catch (e) {
                if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo buscar')
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }, DEBOUNCE_MS)
        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [q, typing, attempt])

    const items: Item[] = typing ? results.map((r) => ({ appid: r.appid, name: r.name, image: r.image, hit: r })) : idle
    const stale = typing && (loading || resultsTerm !== q) && results.length > 0
    const showError = typing && error !== '' && !loading
    const firstLoad = typing && results.length === 0 && !showError && (loading || resultsTerm !== q)
    const none = typing && !loading && !showError && resultsTerm === q && results.length === 0
    const listKey = typing ? `r${version}` : 'idle'
    const activeIndex = Math.min(active, Math.max(0, items.length - 1))

    function remember(item: Item) {
        const next = addRecent(recent, { appid: item.appid, name: item.name, image: item.image })
        setRecent(next)
        saveRecent(next)
    }

    function goTo(item: Item) {
        remember(item)
        onNavigate()
        router.push(`/juego/${item.appid}`)
    }

    function markAdded(appid: number, what: keyof Added) {
        setAdded((m) => new Map(m).set(appid, { ...m.get(appid), [what]: true }))
        setRowError((m) => {
            const next = new Map(m)
            next.delete(appid)
            return next
        })
    }

    function failRow(appid: number, e: unknown, fallback: string) {
        setRowError((m) => new Map(m).set(appid, e instanceof Error ? e.message : fallback))
    }

    async function toBacklog(item: Item) {
        setSaving({ appid: item.appid, to: 'pend' })
        try {
            const current = tracked.get(item.appid)
            // Si ya lo sigues, cambia de lista; si no, entra como pendiente sin comprar, con su precio.
            if (current) await setGamesStatus([item.appid], 'pendiente')
            else await addToPending(item.appid)
            setTracked((m) =>
                new Map(m).set(item.appid, {
                    ...(current ?? {
                        favorite: false,
                        endless: false,
                        owned: false,
                        rating: null,
                        playtime: 0,
                        unlocked: null,
                        total: null,
                        reviews: wished.get(item.appid)?.reviews ?? null,
                        metacritic: item.hit?.metacritic ?? null,
                        price: wished.get(item.appid)?.price ?? null,
                    }),
                    status: 'pendiente',
                })
            )
            markAdded(item.appid, 'pend')
            remember(item)
        } catch (e) {
            failRow(item.appid, e, 'No se pudo añadir a Pendientes')
        } finally {
            setSaving(null)
        }
    }

    async function toWishlist(item: Item) {
        setSaving({ appid: item.appid, to: 'wish' })
        try {
            await addToWishlist(item.appid)
            setWished((m) => new Map(m).set(item.appid, { reviews: null, price: null }))
            markAdded(item.appid, 'wish')
            remember(item)
        } catch (e) {
            failRow(item.appid, e, 'No se pudo añadir a la wishlist')
        } finally {
            setSaving(null)
        }
    }

    function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (items.length === 0 || showError || firstLoad) return
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            const next = (activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
            setActive(next)
            document.getElementById(`game-search-${items[next].appid}`)?.scrollIntoView({ block: 'nearest' })
        } else if (e.key === 'Enter') {
            e.preventDefault()
            goTo(items[activeIndex])
        }
    }

    function row(item: Item, i: number) {
        const t = tracked.get(item.appid)
        const w = wished.get(item.appid)
        const status = t?.status
        const did = added.get(item.appid)
        const known = t?.price ?? w?.price ?? null
        const price = item.price ?? (item.hit ? searchPrice(item.hit, known) : known && { ...known, is_free: false, coming_soon: false })
        const shownPrice = t?.owned ? null : price
        const metacritic = item.hit?.metacritic ?? t?.metacritic ?? null
        const reviews = t?.reviews ?? w?.reviews ?? item.reviews ?? null
        const pend = pendingAction(status)
        const isSaving = (to: 'pend' | 'wish') => saving?.appid === item.appid && saving.to === to

        const statusPart: ReactNode = status ? (
            did?.pend ? (
                <span className="hg-pop-in game-search__swap" style={{ animationDelay: '0s' }}>
                    <StatusChip status={status} />
                </span>
            ) : (
                <StatusChip status={status} />
            )
        ) : w ? (
            <span className={`game-search__wished${did?.wish ? ' hg-pop-in' : ''}`} style={did?.wish ? { animationDelay: '0s' } : undefined}>
                <Heart aria-hidden /> En tu wishlist
            </span>
        ) : (
            <span>No lo tienes</span>
        )

        const pendButton =
            pend === 'done' ? (
                did?.pend ? (
                    <span className="game-search__done hg-tint st-pendiente hg-count--pop" role="status">
                        <Check aria-hidden className="hg-draw" /> En Pendientes
                    </span>
                ) : null
            ) : (
                <Button
                    size="sm"
                    variant="secondary"
                    className="game-search__pend"
                    loading={isSaving('pend')}
                    disabled={saving?.appid === item.appid}
                    onClick={() => toBacklog(item)}
                >
                    <BookmarkPlus aria-hidden /> {pend === 'move' ? 'A Pendientes' : 'Pendientes'}
                </Button>
            )
        const wishButton = did?.wish ? (
            <span className="game-search__done game-search__done--wish" role="status">
                <Heart aria-hidden className="hg-beat" /> En la wishlist
            </span>
        ) : canWishlist(status, Boolean(w)) ? (
            <Button
                size="sm"
                variant="ghost"
                className="game-search__wish"
                loading={isSaving('wish')}
                disabled={saving?.appid === item.appid}
                onClick={() => toWishlist(item)}
            >
                <Heart aria-hidden /> Wishlist
            </Button>
        ) : null
        const hint = (
            <span className="game-search__hint-open" aria-hidden>
                <kbd>Enter</kbd> Abrir ficha
            </span>
        )
        const actions = pendButton || wishButton ? (
            <span className="game-search__actions">
                {pendButton}
                {wishButton}
            </span>
        ) : (
            <span className="game-search__actions game-search__actions--hint">{hint}</span>
        )
        const range = typing ? matchRange(item.name, q) : null
        const name = range ? (
            <>
                {item.name.slice(0, range[0])}
                <mark>{item.name.slice(range[0], range[1])}</mark>
                {item.name.slice(range[1])}
            </>
        ) : (
            item.name
        )
        const err = rowError.get(item.appid)
        const cls = [
            'game-search__item',
            status && `has-st st-${status}`,
            t && !t.owned && 'is-unowned',
            did?.pend && 'is-new-st',
            i === activeIndex && 'is-active',
        ]
            .filter(Boolean)
            .join(' ')

        return (
            <li
                key={`${item.group ?? 'r'}-${item.appid}`}
                id={`game-search-${item.appid}`}
                role="option"
                aria-selected={i === activeIndex}
                className={cls}
                style={{ '--i': i } as CSSProperties}
                onMouseMove={() => i !== activeIndex && setActive(i)}
            >
                {i === activeIndex && (
                    <motion.span layoutId={`game-search-cursor-${listKey}`} className="game-search__cursor" transition={CURSOR_TRANSITION} aria-hidden />
                )}
                <button type="button" className="game-search__open" onClick={() => goTo(item)}>
                    <span className="game-search__cover">
                        {/* eslint-disable-next-line @next/next/no-img-element -- cápsula pequeña del CDN de Steam */}
                        {item.image ? <img src={item.image} alt="" loading="lazy" /> : null}
                    </span>
                    <span className="game-search__text">
                        <span className="game-search__name">
                            <span className="game-search__title">{name}</span>
                            {t && <MarkFlags favorite={t.favorite} endless={t.endless} />}
                        </span>
                        <span className="game-search__meta">
                            {statusPart}
                            {t && !t.owned && (
                                <span className="lib-own lib-own--no">
                                    <ShoppingCart aria-hidden /> Sin comprar
                                </span>
                            )}
                            {t?.owned && (
                                <span className="lib-meta">
                                    <Clock aria-hidden /> {formatHours(t.playtime)}
                                </span>
                            )}
                            {t?.owned && t.total ? (
                                <span className="lib-meta" title={`${t.unlocked ?? 0} de ${t.total} logros`}>
                                    <Trophy aria-hidden /> {t.unlocked ?? 0}/{t.total}
                                </span>
                            ) : null}
                            {t?.rating !== null && t?.rating !== undefined && (
                                <span className={`hg-score hg-tint sc-${ratingTier(t.rating)}`} title="Tu nota">
                                    <Star aria-hidden /> {String(t.rating).replace('.', ',')}
                                </span>
                            )}
                            {metacritic !== null && (
                                <span className={`hg-score hg-tint sc-${metacriticScore(metacritic).tier}`} title={`Metacritic: ${metacriticScore(metacritic).label}`}>
                                    {metacritic}
                                </span>
                            )}
                            {reviews !== null && reviews !== undefined && (status || w) && (
                                <span className={`hg-score hg-tint sc-${steamReviewScore(reviews).tier}`} title={`Reseñas de Steam: ${steamReviewScore(reviews).label}`}>
                                    <ThumbsUp aria-hidden /> {reviews} %
                                </span>
                            )}
                        </span>
                        {err && (
                            <span className="game-search__error" role="alert">
                                <AlertTriangle aria-hidden /> {err}
                            </span>
                        )}
                    </span>
                </button>
                <span className="game-search__price">{shownPrice ? <PriceTag game={shownPrice} /> : pendButton || wishButton ? hint : null}</span>
                {actions}
            </li>
        )
    }

    const recentItems = typing ? [] : items.filter((i) => i.group === 'recent')
    const dealItems = typing ? [] : items.filter((i) => i.group === 'deal')

    let body: ReactNode
    if (!typing && items.length === 0) {
        body = (
            <div className="game-search__state">
                <span className="game-search__state-icon hg-tint st-todos">
                    <Search aria-hidden />
                </span>
                <h3>Busca cualquier juego de Steam</h3>
                <p>Los que ya tienes salen con el color de su lista; los demás, con su precio. Añádelos a Pendientes o a tu wishlist sin salir de aquí.</p>
                <p className="game-search__tip">
                    <kbd>{shortcut}</kbd> abre el buscador desde cualquier página
                </p>
            </div>
        )
    } else if (showError) {
        body = (
            <div className="game-search__state game-search__state--error" role="alert">
                <span className="game-search__state-icon">
                    <AlertTriangle aria-hidden />
                </span>
                <h3>{error}</h3>
                <p>Puede ser un momento: Steam tarda o está caído. Tu búsqueda sigue ahí.</p>
                <Button size="sm" variant="secondary" onClick={() => setAttempt((a) => a + 1)}>
                    <RefreshCw aria-hidden /> Reintentar
                </Button>
            </div>
        )
    } else if (firstLoad) {
        body = (
            <ul className="game-search__results" aria-hidden>
                {[0, 1, 2, 3].map((k) => (
                    <li key={k} className="game-search__skel">
                        <i />
                        <span>
                            <i />
                            <i />
                        </span>
                        <i />
                    </li>
                ))}
            </ul>
        )
    } else if (none) {
        body = (
            <div className="game-search__state">
                <span className="game-search__state-icon game-search__state-icon--neutral">
                    <SearchX aria-hidden />
                </span>
                <h3>Ningún juego de Steam coincide con «{q}»</h3>
                <p>Se busca por el nombre en la tienda de Steam. Prueba con menos palabras o con el nombre en inglés; algunos juegos, como los de consola, no están en Steam.</p>
                <Button asChild size="sm" variant="secondary">
                    <a href={`https://store.steampowered.com/search/?term=${encodeURIComponent(q)}`} target="_blank" rel="noreferrer">
                        <ExternalLink aria-hidden /> Buscar en la tienda de Steam
                    </a>
                </Button>
            </div>
        )
    } else {
        let n = 0
        body = (
            <ul
                key={listKey}
                id="game-search-results"
                className={`game-search__results${typing ? ' game-search__results--new' : ''}${stale ? ' is-stale' : ''}`}
                role="listbox"
                aria-label={typing ? 'Resultados' : 'Recientes y en mínimo'}
            >
                {typing ? (
                    items.map((item) => row(item, n++))
                ) : (
                    <>
                        {recentItems.length > 0 && (
                            <li role="presentation" className="game-search__group">
                                <History aria-hidden /> Recientes
                            </li>
                        )}
                        {recentItems.map((item) => row(item, n++))}
                        {dealItems.length > 0 && (
                            <li role="presentation" className="game-search__group game-search__group--deal">
                                <TrendingDown aria-hidden /> En mínimo en tu wishlist
                                <Link href="/wishlist" className="game-search__group-link" onClick={onNavigate}>
                                    Ver wishlist
                                </Link>
                            </li>
                        )}
                        {dealItems.map((item) => row(item, n++))}
                    </>
                )}
            </ul>
        )
    }

    return (
        <>
            <label className={`game-search__field${loading ? ' is-loading' : ''}`}>
                {loading ? <Loader2 className="game-search__spin" size={20} aria-hidden /> : <Search size={20} aria-hidden />}
                <input
                    autoFocus
                    type="text"
                    enterKeyHint="search"
                    autoComplete="off"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Busca cualquier juego de Steam…"
                    aria-label="Buscar un juego de Steam"
                    aria-controls="game-search-results"
                    aria-activedescendant={items.length && !firstLoad && !showError ? `game-search-${items[activeIndex]?.appid}` : undefined}
                />
            </label>

            <div className="game-search__body">{body}</div>

            <p className="game-search__foot">
                <span className="game-search__keys" aria-hidden>
                    <span>
                        <kbd>↑</kbd> <kbd>↓</kbd> para moverte
                    </span>
                    <span>
                        <kbd>Enter</kbd> abre la ficha
                    </span>
                    <span>
                        <kbd>Esc</kbd> cierra
                    </span>
                </span>
                {typing && results.length > 0 && !stale && (
                    <span>
                        {results.length} {results.length === 1 ? 'resultado' : 'resultados'} de la tienda de Steam
                    </span>
                )}
            </p>
        </>
    )
}

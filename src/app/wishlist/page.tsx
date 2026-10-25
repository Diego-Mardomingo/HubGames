'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, Search, Trash2 } from 'lucide-react'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import {
    WISHLIST_FILTER_LABELS,
    WISHLIST_SORTS,
    WISHLIST_SORT_LABELS,
    isAtHistoricalLow,
    isOnSale,
    matchesWishlistFilter,
    removeFromWishlist,
    sortWishlist,
    type WishlistFilter,
    type WishlistGame,
    type WishlistSort,
} from '@/lib/wishlist'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Loader from '@/components/Loader'
import KeyboardList from '@/components/KeyboardList'
import GameCover from '@/components/tracker/GameCover'
import { openGameSearch } from '@/components/tracker/GameSearch'
import { PriceLows, PriceNow } from '@/components/wishlist/PriceInfo'
import PriceAlertControl from '@/components/wishlist/PriceAlertControl'
import { alertLabel, type AlertMode, type PriceAlert } from '@/lib/price-alerts'
import '../biblioteca/biblioteca.css'
import '@/components/wishlist/wishlist.css'

const PAGE = 50
const FILTERS: WishlistFilter[] = ['todos', 'oferta', 'minimo']
const DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

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

/** Wishlist (#35): juegos que aún no tienes, con precio de Steam, descuento y mínimo histórico (#36). */
export default function WishlistPage() {
    const router = useRouter()
    const [games, setGames] = useState<WishlistGame[] | null>(null)
    const [sort, setSort] = useState<WishlistSort>('descuento')
    const [filter, setFilter] = useState<WishlistFilter>('todos')
    const [visible, setVisible] = useState(PAGE)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState<number | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [alerts, setAlerts] = useState<Map<number, PriceAlert>>(new Map())

    useEffect(() => {
        safeGetSession().then(({ data: { session } }) => {
            if (!session) {
                router.push('/login')
                return
            }
            setUserId(session.user.id)
            loadAlerts()
                .then(setAlerts)
                .catch(() => setAlerts(new Map()))
            loadWishlist()
                .then(setGames)
                .catch((e: Error) => {
                    setError(e.message)
                    setGames([])
                })
        })
    }, [router])

    const counts = useMemo(
        () => ({
            todos: games?.length ?? 0,
            oferta: games?.filter(isOnSale).length ?? 0,
            minimo: games?.filter(isAtHistoricalLow).length ?? 0,
        }),
        [games],
    )
    const list = useMemo(() => sortWishlist((games ?? []).filter((g) => matchesWishlistFilter(g, filter)), sort), [games, filter, sort])
    const lastSync = useMemo(
        () => (games ?? []).reduce<string | null>((max, g) => (g.price_synced_at && (!max || g.price_synced_at > max) ? g.price_synced_at : max), null),
        [games],
    )

    async function remove(appid: number) {
        setBusy(appid)
        setError('')
        try {
            await removeFromWishlist(appid)
            setGames((gs) => gs?.filter((g) => g.appid !== appid) ?? null)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo quitar')
        } finally {
            setBusy(null)
        }
    }

    if (!games) return <Loader label="Cargando wishlist" />

    return (
        <div className="biblioteca">
            <header className="page-head">
                <div>
                    <h1 className="page-title">Wishlist</h1>
                    <p className="page-subtitle">
                        {counts.todos} {counts.todos === 1 ? 'juego' : 'juegos'}
                        {counts.oferta > 0 && `, ${counts.oferta} en oferta`}
                        {counts.minimo > 0 && ` y ${counts.minimo} en mínimo histórico`}.
                        {lastSync && ` Precios del ${DATE.format(new Date(lastSync))}.`}
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

            <div className="wish-toolbar">
                <div className="hg-seg" role="group" aria-label="Filtrar">
                    {FILTERS.map((f) => (
                        <button
                            key={f}
                            type="button"
                            aria-pressed={filter === f}
                            className="hg-seg__opt"
                            onClick={() => {
                                setFilter(f)
                                setVisible(PAGE)
                            }}
                        >
                            {WISHLIST_FILTER_LABELS[f]}
                            <span className="hg-seg__count">{counts[f]}</span>
                        </button>
                    ))}
                </div>
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
            </div>

            {list.length === 0 ? (
                <div className="hg-empty">
                    {counts.todos === 0 ? (
                        <>
                            <p>
                                Tu wishlist está vacía. Se importa sola de Steam cada día (con el perfil público) y también puedes añadir
                                juegos desde el buscador.
                            </p>
                            <Button variant="secondary" onClick={openGameSearch}>
                                <Search aria-hidden /> Buscar un juego
                            </Button>
                        </>
                    ) : (
                        <p>Ningún juego de tu wishlist está {filter === 'oferta' ? 'en oferta' : 'en su mínimo histórico'} ahora mismo.</p>
                    )}
                </div>
            ) : (
                <KeyboardList className="hg-rows wish-list" label="Juegos de tu wishlist">
                    {list.slice(0, visible).map((game, i) => (
                        <WishlistItem
                            key={game.appid}
                            game={game}
                            priority={i < 6}
                            busy={busy === game.appid}
                            onRemove={() => remove(game.appid)}
                            userId={userId}
                            alert={alerts.get(game.appid) ?? null}
                            onAlertSaved={(a) => setAlerts((m) => new Map(m).set(game.appid, a))}
                        />
                    ))}
                </KeyboardList>
            )}

            {list.length > visible && (
                <div className="lib-more">
                    <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE)}>
                        Mostrar más ({list.length - visible})
                    </Button>
                </div>
            )}

            <p className="wish-attribution">
                Precios de la tienda de Steam (España). Mínimos históricos de{' '}
                <a href="https://isthereanydeal.com/" target="_blank" rel="noreferrer">
                    IsThereAnyDeal
                </a>
                .
            </p>
        </div>
    )
}

function WishlistItem({
    game,
    priority,
    busy,
    onRemove,
    userId,
    alert,
    onAlertSaved,
}: {
    game: WishlistGame
    priority: boolean
    busy: boolean
    onRemove: () => void
    userId: string | null
    alert: PriceAlert | null
    onAlertSaved: (alert: PriceAlert) => void
}) {
    const name = game.name ?? `App ${game.appid}`
    return (
        <li className="hg-row wish-row">
            <span className="hg-row__cover">
                <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="header" sizes="112px" priority={priority} />
            </span>
            <div className="hg-row__main wish-row__info">
                <Link href={`/juego/${game.appid}`} className="hg-row__link" data-row-link>
                    {name}
                </Link>
                <p className="wish-row__meta">
                    <span>
                        {game.source === 'steam' ? 'Wishlist de Steam' : 'Añadido en HubGames'} · {DATE.format(new Date(game.date_added))}
                    </span>
                    {game.coming_soon && game.release_date_text && <span>Sale: {game.release_date_text}</span>}
                    {alert && alert.mode !== 'minimo' && <span className="wish-row__alert">{alertLabel(alert)}</span>}
                </p>
                <PriceLows game={game} />
            </div>
            <PriceNow game={game} />
            <div className="wish-row__actions">
                {userId && <PriceAlertControl appid={game.appid} userId={userId} name={name} alert={alert} onSaved={onAlertSaved} />}
                <Button size="icon" variant="ghost" asChild>
                    <a href={`https://store.steampowered.com/app/${game.appid}/`} target="_blank" rel="noreferrer" aria-label={`${name} en la tienda de Steam`} title="Ver en la tienda de Steam">
                        <ExternalLink aria-hidden />
                    </a>
                </Button>
                {game.source === 'manual' && (
                    <Button size="icon" variant="ghost" onClick={onRemove} disabled={busy} aria-label={`Quitar ${name} de la wishlist`} title="Quitar de la wishlist">
                        <Trash2 aria-hidden />
                    </Button>
                )}
            </div>
        </li>
    )
}

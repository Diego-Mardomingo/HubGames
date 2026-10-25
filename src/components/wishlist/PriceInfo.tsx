import { LineChart, TrendingDown } from 'lucide-react'
import { formatPrice, isAtAllStoresLow, isAtHistoricalLow, itadUrl, type WishlistGame } from '@/lib/wishlist'
import './wishlist.css'

export type PriceData = Pick<
    WishlistGame,
    | 'price_initial'
    | 'price_final'
    | 'discount_percent'
    | 'is_free'
    | 'coming_soon'
    | 'itad_id'
    | 'steam_low'
    | 'steam_low_at'
    | 'all_low'
    | 'all_low_shop'
    | 'all_low_at'
>

const DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

function when(iso: string | null): string {
    return iso ? ` (${DATE.format(new Date(iso))})` : ''
}

/** Precio actual en la tienda de Steam, con el descuento si lo hay. */
export function PriceNow({ game }: { game: PriceData }) {
    if (game.price_final === null) {
        return <span className="price-now price-now--none">{game.is_free ? 'Gratis' : game.coming_soon ? 'Próximamente' : 'Sin precio'}</span>
    }
    const onSale = (game.discount_percent ?? 0) > 0
    return (
        <span className="price-now">
            {onSale && <span className="price-now__cut">-{game.discount_percent} %</span>}
            <span className="price-now__amounts">
                {onSale && <s>{formatPrice(game.price_initial)}</s>}
                <strong>{formatPrice(game.price_final)}</strong>
            </span>
        </span>
    )
}

/** Mínimos históricos de IsThereAnyDeal (#36): en Steam y en cualquier tienda, con enlace a su historial. */
export function PriceLows({ game }: { game: PriceData }) {
    if (game.steam_low === null && game.all_low === null) return null
    return (
        <span className="price-lows">
            {isAtHistoricalLow(game) && (
                <span className="price-lows__now" title="El precio actual en Steam es el más bajo que ha tenido">
                    <TrendingDown size={13} aria-hidden /> En mínimo histórico
                </span>
            )}
            {game.steam_low !== null && (
                <span>
                    Mínimo histórico: {formatPrice(game.steam_low)}
                    {when(game.steam_low_at)}
                </span>
            )}
            {game.all_low !== null && game.all_low !== game.steam_low && (
                <span className={isAtAllStoresLow(game) ? 'price-lows__hit' : undefined}>
                    En cualquier tienda: {formatPrice(game.all_low)}
                    {game.all_low_shop ? ` en ${game.all_low_shop}` : ''}
                    {when(game.all_low_at)}
                </span>
            )}
            {game.itad_id && (
                <a
                    className="price-lows__source"
                    href={itadUrl(game.itad_id)}
                    target="_blank"
                    rel="noreferrer"
                    title="Historial de precios en IsThereAnyDeal"
                    aria-label="Historial de precios en IsThereAnyDeal"
                >
                    <LineChart size={13} aria-hidden />
                </a>
            )}
        </span>
    )
}

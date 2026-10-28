import { TrendingDown } from 'lucide-react'
import { formatPrice, isAtHistoricalLow, type WishlistGame } from '@/lib/wishlist'
import '@/styles/lists.css'
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

/**
 * Precio compacto para las filas de la biblioteca (pendientes sin comprar): descuento, precio de hoy y, debajo, el
 * mínimo histórico en amarillo si está en él o el mínimo de Steam en gris si ha estado más barato.
 */
export function PriceTag({ game }: { game: PriceData }) {
    if (game.price_final === null) {
        return <span className="price-tag price-tag--none">{game.is_free ? 'Gratis' : game.coming_soon ? 'Próximamente' : 'Sin precio'}</span>
    }
    const onSale = (game.discount_percent ?? 0) > 0
    return (
        <span className="price-tag">
            {onSale && <span className="price-tag__cut hg-tint sc-top">-{game.discount_percent} %</span>}
            <span className="price-tag__now">
                <strong>{formatPrice(game.price_final)}</strong>
                {onSale && <s>{formatPrice(game.price_initial)}</s>}
            </span>
            {isAtHistoricalLow(game) ? (
                <span className="hg-deal price-tag__low">
                    <TrendingDown aria-hidden /> Mínimo histórico
                </span>
            ) : game.steam_low !== null && game.steam_low < game.price_final ? (
                <span className="price-tag__low price-tag__low--muted">Mínimo: {formatPrice(game.steam_low)}</span>
            ) : null}
        </span>
    )
}

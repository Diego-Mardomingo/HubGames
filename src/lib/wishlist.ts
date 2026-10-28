// Wishlist (#35) y mínimos históricos (#36): tipos de la vista hubgames_wishlist y formato de precios (filtros y orden
// de la página en wishlist-list.ts).
// Sin dependencias del cliente de Supabase, para poder probarlo con node:test.
import type { Database } from './supabase/database.types'

type WishlistRow = Database['public']['Tables']['hubgames_wishlist']['Row']

/** Fila de hubgames_wishlist. La vista marca todo como nullable; estas columnas nunca lo son. */
export type WishlistGame = Omit<WishlistRow, 'user_id' | 'appid' | 'source' | 'priority' | 'date_added'> & {
    user_id: string
    appid: number
    source: 'steam' | 'manual'
    priority: number
    date_added: string
}

type PriceFields = Pick<WishlistGame, 'price_final' | 'discount_percent' | 'steam_low' | 'all_low'>

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

/** Céntimos a "12,99 €". Steam (cc=ES) e IsThereAnyDeal (country=ES) devuelven euros. */
export function formatPrice(cents: number | null): string | null {
    if (cents === null) return null
    return cents === 0 ? 'Gratis' : EUR.format(cents / 100)
}

export function isOnSale(game: PriceFields): boolean {
    return (game.discount_percent ?? 0) > 0
}

/**
 * "¡En mínimo histórico!": el precio actual en Steam iguala (o mejora) su mínimo en Steam. Solo si está rebajado,
 * para que un juego que nunca ha bajado de precio no salga siempre marcado.
 */
export function isAtHistoricalLow(game: PriceFields): boolean {
    return isOnSale(game) && game.price_final !== null && game.steam_low !== null && game.price_final <= game.steam_low
}

/** También en mínimo comparando con todas las tiendas (lo más barato que ha estado en cualquier sitio). */
export function isAtAllStoresLow(game: PriceFields): boolean {
    return isOnSale(game) && game.price_final !== null && game.all_low !== null && game.price_final <= game.all_low
}

/** Ficha del juego en IsThereAnyDeal (se enlaza como fuente de los mínimos, como piden sus condiciones). */
export function itadUrl(itadId: string): string {
    return `https://isthereanydeal.com/game/id:${itadId}/`
}

/** Añade un juego a la wishlist de HubGames (también trae su precio y su mínimo). */
export async function addToWishlist(appid: number): Promise<void> {
    const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appid }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'No se pudo añadir a la wishlist')
}

/**
 * Vuelve a poner un juego que acabas de quitar (Deshacer), con su fecha de alta de antes. No vuelve a pedir el precio:
 * sigue guardado.
 */
export async function restoreToWishlist(appid: number, dateAdded: string): Promise<void> {
    const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appid, restore: { date_added: dateAdded } }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'No se pudo deshacer')
}

/** Quita un juego añadido desde HubGames. Los que vienen de Steam se quitan en Steam. */
export async function removeFromWishlist(appid: number): Promise<void> {
    const res = await fetch(`/api/wishlist?appid=${appid}`, { method: 'DELETE' })
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'No se pudo quitar de la wishlist')
}

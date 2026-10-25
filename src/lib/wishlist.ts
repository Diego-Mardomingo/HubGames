// Wishlist (#35) y mínimos históricos (#36): tipos de la vista hubgames_wishlist, orden, filtros y formato de precios.
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

export const WISHLIST_SORTS = ['descuento', 'precio', 'prioridad', 'recientes', 'nombre'] as const
export type WishlistSort = (typeof WISHLIST_SORTS)[number]

export const WISHLIST_SORT_LABELS: Record<WishlistSort, string> = {
    descuento: 'Mayor descuento',
    precio: 'Precio más bajo',
    prioridad: 'Prioridad de Steam',
    recientes: 'Añadidos recientemente',
    nombre: 'Nombre',
}

export type WishlistFilter = 'todos' | 'oferta' | 'minimo'

export const WISHLIST_FILTER_LABELS: Record<WishlistFilter, string> = {
    todos: 'Todos',
    oferta: 'En oferta',
    minimo: 'En mínimo histórico',
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

export function matchesWishlistFilter(game: PriceFields, filter: WishlistFilter): boolean {
    if (filter === 'oferta') return isOnSale(game)
    if (filter === 'minimo') return isAtHistoricalLow(game)
    return true
}

function byName(a: WishlistGame, b: WishlistGame): number {
    return (a.name ?? '').localeCompare(b.name ?? '', 'es', { sensitivity: 'base' })
}

/** Los que no tienen precio (sin lanzar, retirados) van siempre al final al ordenar por precio o descuento. */
function compare(a: WishlistGame, b: WishlistGame, sort: WishlistSort): number {
    switch (sort) {
        case 'descuento':
            return (b.discount_percent ?? -1) - (a.discount_percent ?? -1) || (a.price_final ?? Infinity) - (b.price_final ?? Infinity)
        case 'precio':
            return (a.price_final ?? Infinity) - (b.price_final ?? Infinity)
        case 'prioridad':
            // En Steam 0 = sin ordenar: van detrás de los ordenados, de más reciente a más antiguo.
            return (a.priority || Infinity) - (b.priority || Infinity) || Date.parse(b.date_added) - Date.parse(a.date_added)
        case 'recientes':
            return Date.parse(b.date_added) - Date.parse(a.date_added)
        case 'nombre':
            return 0
    }
}

export function sortWishlist(games: WishlistGame[], sort: WishlistSort): WishlistGame[] {
    return [...games].sort((a, b) => compare(a, b, sort) || byName(a, b))
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

/** Quita un juego añadido desde HubGames. Los que vienen de Steam se quitan en Steam. */
export async function removeFromWishlist(appid: number): Promise<void> {
    const res = await fetch(`/api/wishlist?appid=${appid}`, { method: 'DELETE' })
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'No se pudo quitar de la wishlist')
}

// /wishlist: filtros con contador, orden, veredicto de precio, duración y €/h de cada fila. Puro, con tests en
// wishlist-list.test.ts (sin el cliente de Supabase).
import { gameDuration, type GameDuration } from './library'
import type { PriceAlert } from './price-alerts'
import { euroPerHour, priceRule, priceVerdict, type PriceVerdict } from './scores'
import { isAtHistoricalLow, isOnSale, type WishlistGame } from './wishlist'

export const WISHLIST_FILTERS = ['todos', 'minimo', 'oferta', 'aviso', 'pronto'] as const
export type WishlistFilter = (typeof WISHLIST_FILTERS)[number]

export const WISHLIST_FILTER_LABELS: Record<WishlistFilter, string> = {
    todos: 'Todos',
    minimo: 'En mínimo histórico',
    oferta: 'En oferta',
    aviso: 'Con aviso',
    pronto: 'Próximamente',
}

export const WISHLIST_SORTS = ['descuento', 'cerca', 'precio', 'valorados', 'prioridad', 'recientes', 'nombre'] as const
export type WishlistSort = (typeof WISHLIST_SORTS)[number]

export const WISHLIST_SORT_LABELS: Record<WishlistSort, string> = {
    descuento: 'Mayor descuento',
    cerca: 'Más cerca de su mínimo',
    precio: 'Precio más bajo',
    valorados: 'Mejor valorados',
    prioridad: 'Prioridad de Steam',
    recientes: 'Añadidos recientemente',
    nombre: 'Nombre',
}

/** Aviso propio: un precio objetivo o un descuento mínimo (sin fila o «Mínimo histórico» es el de por defecto). */
export function hasOwnAlert(alert: PriceAlert | null | undefined): boolean {
    return alert?.mode === 'precio' || alert?.mode === 'descuento'
}

/** Aún sin precio en Steam y por salir. */
export function isComingSoon(game: Pick<WishlistGame, 'price_final' | 'coming_soon'>): boolean {
    return game.price_final === null && !!game.coming_soon
}

export function matchesWishlistFilter(game: WishlistGame, filter: WishlistFilter, alert: PriceAlert | null = null): boolean {
    switch (filter) {
        case 'minimo':
            return isAtHistoricalLow(game)
        case 'oferta':
            return isOnSale(game)
        case 'aviso':
            return hasOwnAlert(alert)
        case 'pronto':
            return isComingSoon(game)
        case 'todos':
            return true
    }
}

export type AlertsByAppid = ReadonlyMap<number, PriceAlert>

/** Cuántos juegos hay en cada filtro (los contadores de la barra). */
export function wishlistCounts(games: WishlistGame[], alerts: AlertsByAppid): Record<WishlistFilter, number> {
    const counts = Object.fromEntries(WISHLIST_FILTERS.map((f) => [f, 0])) as Record<WishlistFilter, number>
    for (const g of games) {
        for (const f of WISHLIST_FILTERS) if (matchesWishlistFilter(g, f, alerts.get(g.appid) ?? null)) counts[f]++
    }
    return counts
}

/** Posición del precio de hoy en su regla (0 = en lo más barato que ha estado), o null sin datos. */
export function lowPosition(game: WishlistGame): number | null {
    return priceRule(game)?.position ?? null
}

function byName(a: WishlistGame, b: WishlistGame): number {
    return (a.name ?? '').localeCompare(b.name ?? '', 'es', { sensitivity: 'base' })
}

/** Los que no tienen el dato (sin precio, sin historial, sin reseñas) van siempre al final. */
function compare(a: WishlistGame, b: WishlistGame, sort: WishlistSort): number {
    switch (sort) {
        case 'descuento':
            return (b.discount_percent ?? -1) - (a.discount_percent ?? -1) || (a.price_final ?? Infinity) - (b.price_final ?? Infinity)
        case 'cerca':
            return (lowPosition(a) ?? Infinity) - (lowPosition(b) ?? Infinity) || (b.discount_percent ?? -1) - (a.discount_percent ?? -1)
        case 'precio':
            return (a.price_final ?? Infinity) - (b.price_final ?? Infinity)
        case 'valorados':
            return (b.steamspy_userscore ?? -1) - (a.steamspy_userscore ?? -1) || (b.metacritic_score ?? -1) - (a.metacritic_score ?? -1)
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

/** El juego que más cerca está de su mínimo (para el vacío del filtro «En mínimo histórico»). */
export function closestToLow(games: WishlistGame[]): WishlistGame | null {
    return sortWishlist(games.filter((g) => lowPosition(g) !== null), 'cerca')[0] ?? null
}

/** Lo que la fila enseña además del precio: veredicto, duración de la historia y €/h. */
export interface WishlistRowFacts {
    verdict: PriceVerdict | null
    duration: GameDuration
    euroPerHour: number | null
}

export function rowFacts(game: WishlistGame): WishlistRowFacts {
    const duration = gameDuration(game)
    return { verdict: priceVerdict(game), duration, euroPerHour: euroPerHour(game.price_final, duration.main) }
}

/** Precio por hora con coma: «0,84 €/h». */
export function formatEuroPerHour(value: number): string {
    return `${value.toFixed(2).replace('.', ',')} €/h`
}

/**
 * Deshacer: vuelve a poner el juego quitado donde estaba (por su posición en la lista original). Si ya está, no lo
 * duplica.
 */
export function restoreAt<T extends { appid: number }>(list: T[], game: T, index: number): T[] {
    if (list.some((g) => g.appid === game.appid)) return list
    const out = [...list]
    out.splice(Math.max(0, Math.min(index, out.length)), 0, game)
    return out
}

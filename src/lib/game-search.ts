// Buscador de juegos (#20, Ctrl + K): resultados de la tienda de Steam, recientes en localStorage y qué acciones tiene
// cada resultado según dónde está ya ese juego para ti. Puro (sin cliente de Supabase), con tests.
import type { GameStatus } from './tracker'
import type { PriceData } from '@/components/wishlist/PriceInfo'

/** Resultado de `/api/steam/search`: precio en céntimos (como en la base de datos) y Metacritic si lo tiene. */
export interface SteamSearchResult {
    appid: number
    name: string
    image: string | null
    price_initial: number | null
    price_final: number | null
    discount_percent: number | null
    /** Sin precio de venta y marcado como gratis en la tienda (precio final 0). */
    is_free: boolean
    metacritic: number | null
}

/** Elemento de la respuesta de `store.steampowered.com/api/storesearch`. */
export interface StoreSearchItem {
    type?: string
    id?: number
    name?: string
    tiny_image?: string
    price?: { currency?: string; initial?: number; final?: number }
    /** Texto: "89", o vacío / "0" si no tiene. */
    metascore?: string
}

function metascore(raw: string | undefined): number | null {
    const n = Number.parseInt(raw ?? '', 10)
    return Number.isFinite(n) && n > 0 && n <= 100 ? n : null
}

/** Solo aplicaciones con id y nombre. El descuento se calcula a partir del precio inicial y el final. */
export function parseStoreSearch(items: StoreSearchItem[]): SteamSearchResult[] {
    return items
        .filter((i) => i.type === 'app' && typeof i.id === 'number' && i.name)
        .map((i) => {
            const final = i.price?.final ?? null
            const initial = i.price?.initial ?? final
            const discount = final !== null && initial && final < initial ? Math.round((1 - final / initial) * 100) : 0
            return {
                appid: i.id!,
                name: i.name!,
                image: i.tiny_image ?? null,
                price_initial: final === 0 ? null : initial,
                price_final: final === 0 ? null : final,
                discount_percent: final === null || final === 0 ? null : discount,
                is_free: final === 0,
                metacritic: metascore(i.metascore),
            }
        })
}

// ── Recientes ──

export const RECENT_KEY = 'hg-search-recent'
export const RECENT_MAX = 5

/** Juego que abriste o añadiste desde el buscador. Su lista se lee al abrir; aquí solo lo necesario para pintarlo. */
export interface RecentGame {
    appid: number
    name: string
    image: string | null
}

/** Lee lo guardado en localStorage; cualquier cosa rara se descarta sin romper el buscador. */
export function parseRecent(raw: string | null): RecentGame[] {
    if (!raw) return []
    let data: unknown
    try {
        data = JSON.parse(raw)
    } catch {
        return []
    }
    if (!Array.isArray(data)) return []
    const out: RecentGame[] = []
    for (const item of data) {
        if (!item || typeof item !== 'object') continue
        const { appid, name, image } = item as Record<string, unknown>
        if (typeof appid !== 'number' || !Number.isInteger(appid) || appid <= 0 || typeof name !== 'string' || !name) continue
        if (out.some((g) => g.appid === appid)) continue
        out.push({ appid, name, image: typeof image === 'string' ? image : null })
        if (out.length === RECENT_MAX) break
    }
    return out
}

/** Pone el juego el primero (sin repetirlo) y se queda con los `max` más recientes. */
export function addRecent(list: RecentGame[], game: RecentGame, max: number = RECENT_MAX): RecentGame[] {
    return [game, ...list.filter((g) => g.appid !== game.appid)].slice(0, max)
}

// ── Coincidencia del término en el nombre (para subrayarla) ──

/** Una letra comparable: minúscula, sin tilde y sin ™/®. Mantiene la longitud para poder cortar el nombre original. */
function fold(name: string): string {
    return Array.from(name, (c) => (c === '™' || c === '®' ? '\u0000' : c.normalize('NFD')[0].toLowerCase())).join('')
}

/** Inicio y fin (exclusivo) de la primera aparición del término en el nombre, o null. */
export function matchRange(name: string, term: string): [number, number] | null {
    const t = fold(term.trim())
    if (t.length < 2) return null
    const chars = Array.from(name)
    const i = fold(name).indexOf(t)
    if (i < 0) return null
    // Las posiciones de fold son de puntos de código; se pasan a índices de la cadena original.
    const start = chars.slice(0, i).join('').length
    return [start, start + chars.slice(i, i + Array.from(t).length).join('').length]
}

// ── Acciones de cada resultado ──

/**
 * «Pendientes»: `add` si no lo sigues (entra como pendiente sin comprar), `move` si está en otra lista (se cambia de
 * estado; el chip ya dice en cuál está) y `done` si ya está en Pendientes.
 */
export type PendingAction = 'add' | 'move' | 'done'

export function pendingAction(status: GameStatus | undefined): PendingAction {
    if (!status) return 'add'
    return status === 'pendiente' ? 'done' : 'move'
}

/** «Wishlist» solo para lo que no sigues ni está ya en la wishlist (los que tienes en Steam no se pueden añadir). */
export function canWishlist(status: GameStatus | undefined, wished: boolean): boolean {
    return !status && !wished
}

// ── Precio ──

/** Precio y mínimos que ya tenemos de un juego que sigues o está en tu wishlist (vistas hubgames_library / hubgames_wishlist). */
export type KnownPrice = Pick<
    PriceData,
    'price_initial' | 'price_final' | 'discount_percent' | 'steam_low' | 'steam_low_at' | 'all_low' | 'all_low_shop' | 'all_low_at' | 'itad_id'
>

/**
 * Precio que se enseña en el resultado: el guardado (con su mínimo histórico) si lo hay, y si no el de la tienda, sin
 * mínimos. null si no hay nada que enseñar (sin precio y no es gratis).
 */
export function searchPrice(hit: SteamSearchResult, known: KnownPrice | null): PriceData | null {
    if (known && known.price_final !== null) {
        return { ...known, is_free: false, coming_soon: false }
    }
    if (hit.price_final === null && !hit.is_free) return null
    return {
        price_initial: hit.price_initial,
        price_final: hit.price_final,
        discount_percent: hit.discount_percent,
        is_free: hit.is_free,
        coming_soon: false,
        itad_id: null,
        steam_low: null,
        steam_low_at: null,
        all_low: null,
        all_low_shop: null,
        all_low_at: null,
    }
}

// Precio de Steam guardado con la ficha (`price_overview` de hubgames_juegos_steam, en céntimos): el respaldo cuando
// no hay precio sincronizado en hubgames_game_prices. Lo usan la ficha y el resultado de JUDI. Puro.

export interface StorePrice {
    initial: number
    final: number
    discount_percent: number
}

/** `price_overview` → precio, o null si no hay. */
export function storePrice(raw: unknown): StorePrice | null {
    const p = raw as { initial?: unknown; final?: unknown; discount_percent?: unknown } | null
    if (!p || typeof p !== 'object' || typeof p.final !== 'number') return null
    return {
        initial: typeof p.initial === 'number' ? p.initial : p.final,
        final: p.final,
        discount_percent: typeof p.discount_percent === 'number' ? p.discount_percent : 0,
    }
}

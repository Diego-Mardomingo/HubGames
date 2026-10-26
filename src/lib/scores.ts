// Color de las puntuaciones (Metacritic, reseñas de Steam y tu nota) y del precio frente a su mínimo. Cada nivel tiene su
// token --sc-* en globals.css; el texto («Muy positivas», «En mínimo histórico») va siempre al lado del color. Puro, con tests.
import { isAtHistoricalLow, isOnSale } from './wishlist'

/** De mejor a peor: verde, lima, ámbar y rojo. */
export type ScoreTier = 'top' | 'good' | 'mid' | 'bad'

export interface Score {
    tier: ScoreTier
    label: string
}

/** Bandas de Metacritic: 75+ favorable, 50-74 variado, menos de 50 desfavorable. */
export function metacriticScore(score: number): Score {
    if (score >= 90) return { tier: 'top', label: 'Aclamado' }
    if (score >= 75) return { tier: 'top', label: 'Favorable' }
    if (score >= 50) return { tier: 'mid', label: 'Variado' }
    return { tier: 'bad', label: 'Desfavorable' }
}

/** Etiquetas de las reseñas de Steam según el % de positivas. */
export function steamReviewScore(percent: number): Score {
    if (percent >= 95) return { tier: 'top', label: 'Extremadamente positivas' }
    if (percent >= 80) return { tier: 'top', label: 'Muy positivas' }
    if (percent >= 70) return { tier: 'good', label: 'Mayormente positivas' }
    if (percent >= 40) return { tier: 'mid', label: 'Variadas' }
    if (percent >= 20) return { tier: 'bad', label: 'Mayormente negativas' }
    return { tier: 'bad', label: 'Muy negativas' }
}

/** Tu nota (0 a 10). */
export function ratingTier(rating: number): ScoreTier {
    if (rating >= 9) return 'top'
    if (rating >= 7) return 'good'
    if (rating >= 5) return 'mid'
    return 'bad'
}

/**
 * Cómo está el precio de hoy: en mínimo histórico de Steam (`low`, el más llamativo), rebajado pero ha estado más barato
 * (`sale`) o a precio normal (`normal`). null sin precio.
 */
export type PriceVerdict = 'low' | 'sale' | 'normal'

type PriceFields = Parameters<typeof isAtHistoricalLow>[0]

export function priceVerdict(game: PriceFields): PriceVerdict | null {
    if (game.price_final === null) return null
    if (isAtHistoricalLow(game)) return 'low'
    return isOnSale(game) ? 'sale' : 'normal'
}

/**
 * Posición (0-100) del precio de hoy entre el mínimo de cualquier tienda (0) y el precio normal (100), para la regla de
 * precios de la ficha. null si faltan datos o no hay recorrido.
 */
export function pricePosition(now: number | null, low: number | null, regular: number | null): number | null {
    if (now === null || low === null || regular === null || regular <= low) return null
    return Math.round(Math.min(100, Math.max(0, ((now - low) / (regular - low)) * 100)))
}

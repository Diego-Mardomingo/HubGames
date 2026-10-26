import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { metacriticScore, pricePosition, priceVerdict, ratingTier, steamReviewScore } from './scores'

const price = (p: Partial<Parameters<typeof priceVerdict>[0]>) => ({ price_final: 1000, discount_percent: 0, steam_low: null, all_low: null, ...p })

describe('puntuaciones', () => {
    it('Metacritic por bandas', () => {
        assert.deepEqual(metacriticScore(96), { tier: 'top', label: 'Aclamado' })
        assert.equal(metacriticScore(75).tier, 'top')
        assert.equal(metacriticScore(74).tier, 'mid')
        assert.equal(metacriticScore(49).tier, 'bad')
    })

    it('reseñas de Steam con las etiquetas de Steam', () => {
        assert.equal(steamReviewScore(96).label, 'Extremadamente positivas')
        assert.deepEqual(steamReviewScore(78), { tier: 'good', label: 'Mayormente positivas' })
        assert.equal(steamReviewScore(55).tier, 'mid')
        assert.equal(steamReviewScore(10).label, 'Muy negativas')
    })

    it('tu nota', () => {
        assert.deepEqual([9.5, 7, 5, 3].map(ratingTier), ['top', 'good', 'mid', 'bad'])
    })
})

describe('precio', () => {
    it('veredicto: mínimo histórico, rebajado o normal', () => {
        assert.equal(priceVerdict(price({ discount_percent: 40, price_final: 3599, steam_low: 3599 })), 'low')
        assert.equal(priceVerdict(price({ discount_percent: 67, price_final: 1979, steam_low: 1499 })), 'sale')
        // Sin rebaja nunca es "mínimo", aunque nunca haya bajado.
        assert.equal(priceVerdict(price({ steam_low: 1000 })), 'normal')
        assert.equal(priceVerdict(price({ price_final: null })), null)
    })

    it('posición entre el mínimo y el precio normal', () => {
        assert.equal(pricePosition(3599, 2815, 5999), 25)
        assert.equal(pricePosition(2000, 2815, 5999), 0)
        assert.equal(pricePosition(5999, 5999, 5999), null)
        assert.equal(pricePosition(null, 1, 2), null)
    })
})

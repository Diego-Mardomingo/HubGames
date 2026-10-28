import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { costPerHourTier, euroPerHour, metacriticScore, pricePosition, priceRule, priceVerdict, ratingLabel, ratingTier, steamReviewScore } from './scores'

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

    it('tu nota en palabras, con los mismos umbrales que su color', () => {
        assert.deepEqual([10, 9, 8.5, 7, 6.5, 5, 4.5, 0].map(ratingLabel), [
            'Imprescindible',
            'Imprescindible',
            'Muy bueno',
            'Muy bueno',
            'Correcto',
            'Correcto',
            'Flojo',
            'Flojo',
        ])
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

describe('regla de precios y €/h', () => {
    it('priceRule: posición de hoy, tramo del mínimo de Steam, suelo y precio normal', () => {
        assert.deepEqual(priceRule({ price_initial: 5999, price_final: 2099, steam_low: 2099, all_low: 1799 }), {
            position: 7,
            steamLowAt: 7,
            floor: 1799,
            regular: 5999,
        })
        assert.equal(priceRule({ price_initial: 2299, price_final: 2299, steam_low: null, all_low: null }), null)
        assert.equal(priceRule({ price_initial: null, price_final: null, steam_low: 999, all_low: null }), null)
    })

    it('€/h y su color', () => {
        assert.equal(euroPerHour(2000, 1200), 1)
        assert.equal(euroPerHour(null, 600), null)
        assert.equal(euroPerHour(999, null), null)
        assert.deepEqual([0.8, 1.5, 3, 6].map(costPerHourTier), ['top', 'good', 'mid', 'bad'])
    })
})

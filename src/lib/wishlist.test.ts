import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatPrice, isAtAllStoresLow, isAtHistoricalLow, type WishlistGame } from './wishlist'
import { priceDay } from './prices'

let nextAppid = 1

function game(overrides: Partial<WishlistGame> = {}): WishlistGame {
    return {
        user_id: 'u',
        appid: nextAppid++,
        source: 'steam',
        priority: 0,
        date_added: '2026-01-01T00:00:00Z',
        name: 'Juego',
        header_image: null,
        release_date: null,
        release_date_text: null,
        coming_soon: false,
        is_free: false,
        genres: null,
        steamspy_userscore: null,
        currency: 'EUR',
        price_initial: 2999,
        price_final: 2999,
        discount_percent: 0,
        price_synced_at: null,
        itad_id: null,
        steam_low: null,
        steam_low_at: null,
        all_low: null,
        all_low_shop: null,
        all_low_at: null,
        metacritic_score: null,
        steamspy_median_forever: null,
        hltb_main: null,
        hltb_main_extra: null,
        hltb_completionist: null,
        ...overrides,
    }
}

describe('formatPrice', () => {
    it('formatea céntimos en euros', () => {
        assert.equal(formatPrice(1999)?.replace(/\s/g, ' '), '19,99 €')
        assert.equal(formatPrice(0), 'Gratis')
        assert.equal(formatPrice(null), null)
    })
})

describe('isAtHistoricalLow', () => {
    it('marca el juego rebajado a su mínimo en Steam o por debajo', () => {
        assert.equal(isAtHistoricalLow(game({ price_final: 799, discount_percent: 80, steam_low: 799 })), true)
        assert.equal(isAtHistoricalLow(game({ price_final: 699, discount_percent: 80, steam_low: 799 })), true)
        assert.equal(isAtHistoricalLow(game({ price_final: 999, discount_percent: 66, steam_low: 799 })), false)
    })

    it('no marca un juego sin rebaja aunque nunca haya bajado de precio', () => {
        assert.equal(isAtHistoricalLow(game({ price_final: 2999, discount_percent: 0, steam_low: 2999 })), false)
    })

    it('sin datos de mínimo o de precio no marca nada', () => {
        assert.equal(isAtHistoricalLow(game({ discount_percent: 50, steam_low: null })), false)
        assert.equal(isAtHistoricalLow(game({ price_final: null, discount_percent: null, steam_low: 500 })), false)
    })

    it('compara aparte con el mínimo de todas las tiendas', () => {
        const g = game({ price_final: 799, discount_percent: 80, steam_low: 799, all_low: 285 })
        assert.equal(isAtHistoricalLow(g), true)
        assert.equal(isAtAllStoresLow(g), false)
    })
})

describe('priceDay', () => {
    it('la madrugada en Madrid cuenta como el día anterior', () => {
        // 01:00 UTC = 03:00 en Madrid (verano): con 6 h de retraso es el día anterior.
        assert.equal(priceDay(Date.parse('2026-07-15T01:00:00Z')), '2026-07-14')
        assert.equal(priceDay(Date.parse('2026-07-15T12:00:00Z')), '2026-07-15')
    })
})

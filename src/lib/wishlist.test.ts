import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatPrice, isAtAllStoresLow, isAtHistoricalLow, matchesWishlistFilter, sortWishlist, type WishlistGame } from './wishlist'
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

describe('matchesWishlistFilter', () => {
    it('filtra por oferta y por mínimo', () => {
        const sale = game({ price_final: 1499, discount_percent: 50, steam_low: 999 })
        const low = game({ price_final: 999, discount_percent: 66, steam_low: 999 })
        const full = game()
        assert.deepEqual([sale, low, full].filter((g) => matchesWishlistFilter(g, 'oferta')), [sale, low])
        assert.deepEqual([sale, low, full].filter((g) => matchesWishlistFilter(g, 'minimo')), [low])
        assert.equal([sale, low, full].filter((g) => matchesWishlistFilter(g, 'todos')).length, 3)
    })
})

describe('sortWishlist', () => {
    it('por descuento, con los que no tienen precio al final', () => {
        const a = game({ name: 'A', discount_percent: 20 })
        const b = game({ name: 'B', discount_percent: 75 })
        const c = game({ name: 'C', price_final: null, discount_percent: null })
        const d = game({ name: 'D', discount_percent: 0 })
        assert.deepEqual(sortWishlist([a, c, d, b], 'descuento').map((g) => g.name), ['B', 'A', 'D', 'C'])
    })

    it('por precio, de más barato a más caro', () => {
        const a = game({ name: 'A', price_final: 1999 })
        const b = game({ name: 'B', price_final: 499 })
        const c = game({ name: 'C', price_final: null })
        assert.deepEqual(sortWishlist([a, c, b], 'precio').map((g) => g.name), ['B', 'A', 'C'])
    })

    it('por prioridad: primero los ordenados en Steam y después los demás, más recientes antes', () => {
        const a = game({ name: 'A', priority: 2 })
        const b = game({ name: 'B', priority: 1 })
        const c = game({ name: 'C', priority: 0, date_added: '2025-01-01T00:00:00Z' })
        const d = game({ name: 'D', priority: 0, date_added: '2026-06-01T00:00:00Z' })
        assert.deepEqual(sortWishlist([c, a, d, b], 'prioridad').map((g) => g.name), ['B', 'A', 'D', 'C'])
    })

    it('desempata por nombre', () => {
        const a = game({ name: 'Zelda', discount_percent: 50 })
        const b = game({ name: 'Ápex', discount_percent: 50, price_final: 2999 })
        assert.deepEqual(sortWishlist([a, b], 'descuento').map((g) => g.name), ['Ápex', 'Zelda'])
    })
})

describe('priceDay', () => {
    it('la madrugada en Madrid cuenta como el día anterior', () => {
        // 01:00 UTC = 03:00 en Madrid (verano): con 6 h de retraso es el día anterior.
        assert.equal(priceDay(Date.parse('2026-07-15T01:00:00Z')), '2026-07-14')
        assert.equal(priceDay(Date.parse('2026-07-15T12:00:00Z')), '2026-07-15')
    })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { WishlistGame } from './wishlist'
import type { PriceAlert } from './price-alerts'
import {
    closestToLow,
    formatEuroPerHour,
    hasOwnAlert,
    lowPosition,
    matchesWishlistFilter,
    restoreAt,
    rowFacts,
    sortWishlist,
    wishlistCounts,
} from './wishlist-list'

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


const alert = (mode: PriceAlert['mode'], extra: Partial<PriceAlert> = {}): PriceAlert => ({
    mode,
    target_price: null,
    target_discount: null,
    last_notified_price: null,
    ...extra,
})

describe('filtros nuevos', () => {
    it('«Con aviso» son los de aviso propio (precio o descuento), no el de por defecto ni apagado', () => {
        assert.equal(hasOwnAlert(alert('precio', { target_price: 999 })), true)
        assert.equal(hasOwnAlert(alert('descuento', { target_discount: 30 })), true)
        assert.equal(hasOwnAlert(alert('minimo')), false)
        assert.equal(hasOwnAlert(alert('off')), false)
        assert.equal(hasOwnAlert(null), false)
        assert.equal(matchesWishlistFilter(game(), 'aviso', alert('precio', { target_price: 999 })), true)
        assert.equal(matchesWishlistFilter(game(), 'aviso'), false)
    })

    it('«Próximamente» son los que aún no tienen precio y están por salir', () => {
        assert.equal(matchesWishlistFilter(game({ price_final: null, coming_soon: true }), 'pronto'), true)
        assert.equal(matchesWishlistFilter(game({ price_final: null, coming_soon: false }), 'pronto'), false)
        assert.equal(matchesWishlistFilter(game({ coming_soon: true }), 'pronto'), false)
    })

    it('cuenta cada filtro', () => {
        const low = game({ price_final: 999, discount_percent: 66, steam_low: 999 })
        const sale = game({ price_final: 1499, discount_percent: 50, steam_low: 999 })
        const soon = game({ price_final: null, discount_percent: null, coming_soon: true })
        const full = game()
        const alerts = new Map([[full.appid, alert('descuento', { target_discount: 30 })]])
        assert.deepEqual(wishlistCounts([low, sale, soon, full], alerts), { todos: 4, minimo: 1, oferta: 2, aviso: 1, pronto: 1 })
    })
})

describe('órdenes nuevos', () => {
    it('«Más cerca de su mínimo»: por posición en la regla, sin historial al final', () => {
        const a = game({ name: 'A', price_initial: 4000, price_final: 2000, discount_percent: 50, all_low: 1000 }) // 33
        const b = game({ name: 'B', price_initial: 4000, price_final: 1000, discount_percent: 75, all_low: 1000 }) // 0
        const c = game({ name: 'C', price_initial: 4000, price_final: 4000 }) // sin mínimo
        const d = game({ name: 'D', price_initial: 2000, price_final: 1800, discount_percent: 10, steam_low: 1000 }) // 80
        assert.equal(lowPosition(a), 33)
        assert.equal(lowPosition(c), null)
        assert.deepEqual(sortWishlist([c, d, a, b], 'cerca').map((g) => g.name), ['B', 'A', 'D', 'C'])
        assert.equal(closestToLow([c, d, a])?.name, 'A')
        assert.equal(closestToLow([c]), null)
    })

    it('«Mejor valorados»: reseñas de Steam y, a igualdad, Metacritic; sin notas al final', () => {
        const a = game({ name: 'A', steamspy_userscore: 90, metacritic_score: 80 })
        const b = game({ name: 'B', steamspy_userscore: 90, metacritic_score: 92 })
        const c = game({ name: 'C' })
        const d = game({ name: 'D', steamspy_userscore: 96 })
        assert.deepEqual(sortWishlist([c, a, d, b], 'valorados').map((g) => g.name), ['D', 'B', 'A', 'C'])
    })
})

describe('rowFacts', () => {
    it('historia de HowLongToBeat (o la mediana de SteamSpy) y €/h', () => {
        const hltb = rowFacts(game({ price_final: 1500, hltb_main: 600, steamspy_median_forever: 300 }))
        assert.equal(hltb.duration.main, 600)
        assert.equal(hltb.duration.source, 'hltb')
        assert.equal(hltb.euroPerHour, 1.5)
        const spy = rowFacts(game({ price_final: 1500, steamspy_median_forever: 300 }))
        assert.equal(spy.duration.source, 'steamspy')
        assert.equal(spy.euroPerHour, 3)
        assert.equal(rowFacts(game({ price_final: 1500 })).euroPerHour, null)
        assert.equal(rowFacts(game({ price_final: 0, hltb_main: 600 })).euroPerHour, null)
        assert.equal(formatEuroPerHour(0.84), '0,84 €/h')
    })

    it('veredicto del precio', () => {
        assert.equal(rowFacts(game({ price_final: 999, discount_percent: 66, steam_low: 999 })).verdict, 'low')
        assert.equal(rowFacts(game({ price_final: 1499, discount_percent: 50, steam_low: 999 })).verdict, 'sale')
        assert.equal(rowFacts(game()).verdict, 'normal')
        assert.equal(rowFacts(game({ price_final: null })).verdict, null)
    })
})

describe('restoreAt', () => {
    it('vuelve a poner el juego en su sitio sin duplicarlo', () => {
        const [a, b, c] = [game({ name: 'A' }), game({ name: 'B' }), game({ name: 'C' })]
        assert.deepEqual(restoreAt([a, c], b, 1).map((g) => g.name), ['A', 'B', 'C'])
        assert.deepEqual(restoreAt([a], c, 9).map((g) => g.name), ['A', 'C'])
        assert.deepEqual(restoreAt([a, b], b, 0).map((g) => g.name), ['A', 'B'])
    })
})

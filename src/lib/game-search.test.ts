import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    addRecent,
    canWishlist,
    matchRange,
    parseRecent,
    parseStoreSearch,
    pendingAction,
    RECENT_MAX,
    searchPrice,
    type KnownPrice,
    type SteamSearchResult,
} from './game-search'

describe('parseStoreSearch', () => {
    it('pasa precio, descuento y Metacritic y descarta lo que no es una app', () => {
        const out = parseStoreSearch([
            { type: 'app', id: 374320, name: 'DARK SOULS™ III', tiny_image: 'a.jpg', price: { initial: 5999, final: 1499 }, metascore: '89' },
            { type: 'sub', id: 94174, name: 'DARK SOULS III Deluxe Edition', price: { initial: 8498, final: 8498 }, metascore: '0' },
            { type: 'app', name: 'Sin id' },
        ])
        assert.deepEqual(out, [
            { appid: 374320, name: 'DARK SOULS™ III', image: 'a.jpg', price_initial: 5999, price_final: 1499, discount_percent: 75, is_free: false, metacritic: 89 },
        ])
    })

    it('sin Metacritic, sin precio o gratis', () => {
        const [noScore, noPrice, free] = parseStoreSearch([
            { type: 'app', id: 1, name: 'A', price: { initial: 1379, final: 1379 }, metascore: '' },
            { type: 'app', id: 2, name: 'B' },
            { type: 'app', id: 3, name: 'C', price: { initial: 0, final: 0 } },
        ])
        assert.equal(noScore.metacritic, null)
        assert.equal(noScore.discount_percent, 0)
        assert.equal(noPrice.price_final, null)
        assert.equal(noPrice.is_free, false)
        assert.equal(free.is_free, true)
        assert.equal(free.price_final, null)
    })
})

describe('recientes', () => {
    it('lee lo guardado y descarta lo que no vale', () => {
        const raw = JSON.stringify([
            { appid: 1245620, name: 'ELDEN RING', image: 'e.jpg' },
            { appid: 1245620, name: 'ELDEN RING', image: 'e.jpg' },
            { appid: -1, name: 'Mal' },
            { appid: 2379780, name: 'Balatro' },
            'basura',
        ])
        assert.deepEqual(parseRecent(raw), [
            { appid: 1245620, name: 'ELDEN RING', image: 'e.jpg' },
            { appid: 2379780, name: 'Balatro', image: null },
        ])
        assert.deepEqual(parseRecent('{no es json'), [])
        assert.deepEqual(parseRecent(null), [])
        assert.deepEqual(parseRecent('{"appid":1}'), [])
    })

    it('el último va primero, sin repetir y como mucho 5', () => {
        let list = parseRecent(null)
        for (let i = 1; i <= 7; i++) list = addRecent(list, { appid: i, name: `J${i}`, image: null })
        assert.equal(list.length, RECENT_MAX)
        assert.deepEqual(list.map((g) => g.appid), [7, 6, 5, 4, 3])
        list = addRecent(list, { appid: 4, name: 'J4', image: null })
        assert.deepEqual(list.map((g) => g.appid), [4, 7, 6, 5, 3])
    })
})

describe('matchRange', () => {
    it('sin distinguir mayúsculas ni tildes', () => {
        assert.deepEqual(matchRange('DARK SOULS™ III', 'souls'), [5, 10])
        assert.deepEqual(matchRange('MARVEL Tōkon: Fighting Souls', 'tokon'), [7, 12])
        assert.deepEqual(matchRange('Pokémon', 'POKEMON'), [0, 7])
    })

    it('null si no aparece o el término es muy corto', () => {
        assert.equal(matchRange('Hades II', 'zelda'), null)
        assert.equal(matchRange('Hades II', 'h'), null)
    })
})

describe('acciones', () => {
    it('Pendientes: añadir, mover o ya está', () => {
        assert.equal(pendingAction(undefined), 'add')
        assert.equal(pendingAction('pendiente'), 'done')
        assert.equal(pendingAction('completado'), 'move')
        assert.equal(pendingAction('ya_jugado'), 'move')
        assert.equal(pendingAction('otros'), 'move')
    })

    it('Wishlist solo si no lo sigues ni está ya', () => {
        assert.equal(canWishlist(undefined, false), true)
        assert.equal(canWishlist(undefined, true), false)
        assert.equal(canWishlist('pendiente', false), false)
    })
})

describe('searchPrice', () => {
    const hit: SteamSearchResult = { appid: 1, name: 'A', image: null, price_initial: 3999, price_final: 999, discount_percent: 75, is_free: false, metacritic: null }
    const known: KnownPrice = {
        price_initial: 3999,
        price_final: 999,
        discount_percent: 75,
        steam_low: 999,
        steam_low_at: '2026-10-01',
        all_low: 899,
        all_low_shop: 'GOG',
        all_low_at: '2026-09-01',
        itad_id: 'x',
    }

    it('usa el precio guardado (con su mínimo) si lo hay', () => {
        assert.equal(searchPrice(hit, known)?.steam_low, 999)
    })

    it('si no, el de la tienda sin mínimos', () => {
        const p = searchPrice(hit, null)
        assert.equal(p?.price_final, 999)
        assert.equal(p?.steam_low, null)
        assert.equal(searchPrice(hit, { ...known, price_final: null })?.steam_low, null)
    })

    it('nada si no tiene precio ni es gratis', () => {
        assert.equal(searchPrice({ ...hit, price_final: null, price_initial: null }, null), null)
        assert.equal(searchPrice({ ...hit, price_final: null, price_initial: null, is_free: true }, null)?.is_free, true)
    })
})

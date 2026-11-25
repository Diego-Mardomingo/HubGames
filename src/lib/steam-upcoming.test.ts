import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { appidFromAsset, parseReleaseDay } from './steam-upcoming'

describe('lo más esperado en Steam', () => {
    it('solo fechas con día concreto', () => {
        assert.equal(parseReleaseDay('23 Feb, 2027'), '2027-02-23')
        assert.equal(parseReleaseDay('Feb 3, 2027'), '2027-02-03')
        assert.equal(parseReleaseDay('4 December 2026'), '2026-12-04')
        assert.equal(parseReleaseDay('Q1 2027'), null)
        assert.equal(parseReleaseDay('2027'), null)
        assert.equal(parseReleaseDay('Coming soon'), null)
        assert.equal(parseReleaseDay('To be announced'), null)
        assert.equal(parseReleaseDay(undefined), null)
    })

    it('appid de la cápsula del resultado de búsqueda', () => {
        assert.equal(appidFromAsset('https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2769570/abc/capsule_sm_120.jpg?t=1'), 2769570)
        assert.equal(appidFromAsset('https://example.com/x.jpg'), null)
    })
})

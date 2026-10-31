import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { deviceNameFromUA, wantsType } from './notification-prefs'

describe('wantsType', () => {
    it('respeta lo que diga el dispositivo', () => {
        assert.equal(wantsType({ judi: false, price: true }, 'judi'), false)
        assert.equal(wantsType({ judi: false, price: true }, 'price'), true)
    })

    it('un tipo ausente o unas preferencias raras cuentan como activadas', () => {
        assert.equal(wantsType({ judi: false }, 'price'), true)
        assert.equal(wantsType({}, 'judi'), true)
        assert.equal(wantsType(null, 'judi'), true)
        assert.equal(wantsType([], 'judi'), true)
    })
})

describe('deviceNameFromUA', () => {
    const cases: [string, string][] = [
        ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 'Chrome en Windows'],
        ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0', 'Edge en Windows'],
        ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', 'Chrome en Android'],
        ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'Safari en iPhone'],
        ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:131.0) Gecko/20100101 Firefox/131.0', 'Firefox en Mac'],
        ['Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0', 'Firefox en Linux'],
    ]
    for (const [ua, name] of cases) it(name, () => assert.equal(deviceNameFromUA(ua), name))

    it('marca la PWA instalada', () => {
        assert.equal(deviceNameFromUA(cases[2][0], true), 'Chrome en Android (app)')
    })
})

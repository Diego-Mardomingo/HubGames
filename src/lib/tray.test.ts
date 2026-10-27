import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { addToSession, destinationForKey, destinationKey, isSoftware, sessionSegments, sessionTotal, suggestDestination, TRAY_DESTINATIONS } from './tray'
import { libraryGame as game } from './test-utils'

const NOW = Date.parse('2026-10-27T12:00:00Z')
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString()
const sug = (overrides: Parameters<typeof game>[0]) => suggestDestination(game(overrides), NOW)?.status ?? null

describe('bandeja: teclas', () => {
    it('1–9 en el orden de GAME_STATUSES, sin la bandeja', () => {
        assert.deepEqual(TRAY_DESTINATIONS, ['pendiente', 'jugando', 'pausado', 'rejugable', 'completado', 'abandonado', 'ya_jugado', 'descartado', 'otros'])
        assert.equal(destinationForKey('1'), 'pendiente')
        assert.equal(destinationForKey('3'), 'pausado')
        assert.equal(destinationForKey('9'), 'otros')
        assert.equal(destinationForKey('0'), null)
        assert.equal(destinationForKey('x'), null)
        assert.equal(destinationKey('rejugable'), 4)
    })
})

describe('bandeja: destino sugerido', () => {
    it('0 h → Pendiente', () => {
        assert.equal(sug({ playtime_forever: 0 }), 'pendiente')
    })

    it('jugado estas dos semanas → Jugando (horas recientes o última partida)', () => {
        assert.equal(sug({ playtime_forever: 600, playtime_2weeks: 90, hltb_main: 1800 }), 'jugando')
        assert.equal(sug({ playtime_forever: 600, rtime_last_played: daysAgo(3), hltb_main: 1800 }), 'jugando')
        assert.equal(sug({ playtime_forever: 600, rtime_last_played: daysAgo(20), hltb_main: 1800 }), null)
    })

    it('más horas que la historia → Ya jugado', () => {
        assert.equal(sug({ playtime_forever: 1400, hltb_main: 510, rtime_last_played: daysAgo(400) }), 'ya_jugado')
        assert.equal(sug({ playtime_forever: 200, hltb_main: 510 }), null)
    })

    it('sin historia y más de 50 h → Rejugable (antes que Jugando)', () => {
        assert.equal(sug({ playtime_forever: 412 * 60, playtime_2weeks: 180 }), 'rejugable')
        assert.equal(sug({ playtime_forever: 40 * 60 }), null)
        assert.equal(sug({ playtime_forever: 60 * 60, hltb_main: 30 * 60 }), 'ya_jugado')
    })

    it('programas (Utilidades y otros géneros de software) → Otros', () => {
        const genres = [{ id: '57', description: 'Utilidades' }]
        assert.equal(isSoftware(game({ genres })), true)
        assert.equal(sug({ genres, playtime_forever: 120 * 60 }), 'otros')
        assert.equal(sug({ genres: [{ id: '51', description: 'Animación y modelado' }] }), 'otros')
        assert.equal(isSoftware(game({ genres: [{ id: '1', description: 'Acción' }] })), false)
    })
})

describe('bandeja: lo clasificado en esta visita', () => {
    it('suma, resta y quita los que se quedan en 0', () => {
        let s = addToSession({}, 'jugando', 2)
        s = addToSession(s, 'pendiente', 1)
        assert.equal(sessionTotal(s), 3)
        s = addToSession(s, 'jugando', -2)
        assert.deepEqual(s, { pendiente: 1 })
    })

    it('segmentos en el orden de los destinos, con su inicio y su fracción', () => {
        const segs = sessionSegments({ pendiente: 1, ya_jugado: 3 })
        assert.equal(segs.length, 9)
        const p = segs.find((x) => x.status === 'pendiente')!
        const y = segs.find((x) => x.status === 'ya_jugado')!
        assert.deepEqual([p.x, p.f], [0, 0.25])
        assert.deepEqual([y.x, y.f], [25, 0.75])
        assert.equal(sessionSegments({}).every((x) => x.f === 0), true)
    })
})

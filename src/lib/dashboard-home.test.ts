import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parkedGames, queueHorizon, queueMinutes, untilRelease, upcomingReleases, weekStrip, weeklyPace } from './dashboard'
import { libraryGame as game } from './test-utils'

describe('inicio', () => {
    it('tu semana: 7 días acabando hoy, con minutos, logros y el juego más jugado', () => {
        const week = weekStrip(
            [
                { date: '2026-11-25', appid: 1, minutes: 20 },
                { date: '2026-11-25', appid: 2, minutes: 50 },
                { date: '2026-11-24', appid: 1, minutes: 30 },
                { date: '2026-11-10', appid: 1, minutes: 99 },
            ],
            ['2026-11-25', '2026-11-25', '2026-11-19'],
            '2026-11-25',
        )
        assert.equal(week.length, 7)
        assert.deepEqual(
            week.map((d) => d.label),
            ['ju', 'vi', 'sá', 'do', 'lu', 'ma', 'Hoy'],
        )
        assert.deepEqual(week[6], { date: '2026-11-25', label: 'Hoy', today: true, minutes: 70, unlocks: 2, appid: 2 })
        assert.equal(week[5].appid, 1)
        assert.equal(week[0].unlocks, 1)
        assert.equal(week[1].appid, null)
    })

    it('ritmo: media semanal de los últimos 28 días', () => {
        const rows = [
            { date: '2026-11-25', appid: 1, minutes: 280 },
            { date: '2026-10-29', appid: 1, minutes: 280 },
            { date: '2026-10-28', appid: 1, minutes: 9999 },
        ]
        assert.equal(weeklyPace(rows, '2026-11-25'), 140)
    })

    it('horizonte: el primero ya con hueco libre; los demás suman lo que falta de los anteriores', () => {
        const queue = [
            game({ name: 'A', status: 'pendiente', hltb_main: 600 }),
            game({ name: 'B', status: 'pendiente', hltb_main: 1200, endless: true }),
            game({ name: 'C', status: 'pendiente', hltb_main: 300 }),
        ]
        assert.deepEqual(queueHorizon(queue, 600, true), [0, 1, 1])
        assert.deepEqual(queueHorizon(queue, 300, false), [1, 2, 2])
        assert.deepEqual(queueHorizon(queue, 0, true), [null, null, null])
        assert.equal(queueMinutes(queue), 900)
    })

    it('aparcados: pausados o jugando con más de 60 días sin abrir, el más olvidado primero', () => {
        const now = Date.parse('2026-11-25T12:00:00Z')
        const list = [
            game({ name: 'Reciente', status: 'pausado', rtime_last_played: '2026-11-01T00:00:00Z' }),
            game({ name: 'Viejo', status: 'pausado', rtime_last_played: '2026-06-01T00:00:00Z' }),
            game({ name: 'Olvidado', status: 'jugando', rtime_last_played: '2026-09-01T00:00:00Z' }),
            game({ name: 'Completado', status: 'completado', rtime_last_played: '2025-01-01T00:00:00Z' }),
            game({ name: 'Nunca', status: 'pausado' }),
        ]
        assert.deepEqual(
            parkedGames(list, now).map((p) => [p.game.name, p.days]),
            [
                ['Viejo', 177],
                ['Olvidado', 85],
            ],
        )
    })

    it('sale pronto: solo con fecha y desde hoy, el más cercano primero', () => {
        const rows = [
            { name: 'Lejos', release_date: '2027-02-23' },
            { name: 'Sin fecha', release_date: null },
            { name: 'Ya salió', release_date: '2026-11-01' },
            { name: 'Hoy', release_date: '2026-11-25' },
            { name: 'Pronto', release_date: '2026-12-04' },
        ]
        assert.deepEqual(
            upcomingReleases(rows, '2026-11-25').map((r) => [r.name, r.days]),
            [
                ['Hoy', 0],
                ['Pronto', 9],
                ['Lejos', 90],
            ],
        )
        assert.deepEqual([0, 1, 9, 23, 90].map(untilRelease), ['Hoy', 'Mañana', 'En 9 días', 'En 3 semanas', 'En 3 meses'])
    })
})

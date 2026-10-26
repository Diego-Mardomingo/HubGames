import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isMissingRpc, judiStreak, judiTodayState, nearHundred, nextInQueue, playingNow, recentActivity, remainingMinutes, yearSummary } from './dashboard'
import { libraryGame as game } from './test-utils'

const names = (list: { name: string | null }[]) => list.map((g) => g.name)

describe('dashboard', () => {
    it('jugando ahora: solo "Jugando", la última partida primero', () => {
        const list = [
            game({ name: 'Viejo', status: 'jugando', rtime_last_played: '2026-10-01T00:00:00Z' }),
            game({ name: 'Pendiente', status: 'pendiente', rtime_last_played: '2026-10-24T00:00:00Z' }),
            game({ name: 'Nuevo', status: 'jugando', rtime_last_played: '2026-10-20T00:00:00Z' }),
            game({ name: 'Nunca', status: 'jugando' }),
        ]
        assert.deepEqual(names(playingNow(list)), ['Nuevo', 'Viejo', 'Nunca'])
    })

    it('siguientes en la cola: los 5 primeros pendientes en tu orden', () => {
        const list = [
            game({ name: 'Sin posición', backlog_position: null }),
            ...[5, 1, 3, 2, 4, 6].map((p) => game({ name: `P${p}`, backlog_position: p })),
            game({ name: 'Jugando', status: 'jugando', backlog_position: 0 }),
        ]
        assert.deepEqual(names(nextInQueue(list)), ['P1', 'P2', 'P3', 'P4', 'P5'])
        assert.deepEqual(names(nextInQueue(list, 10)).at(-1), 'Sin posición')
    })

    it('cerca del 100 %: sin descartados', () => {
        const list = [
            game({ name: 'Casi', achievements_total: 10, achievements_unlocked: 9 }),
            game({ name: 'Descartado', status: 'descartado', achievements_total: 10, achievements_unlocked: 9 }),
            game({ name: 'Lejos', achievements_total: 10, achievements_unlocked: 2 }),
        ]
        assert.deepEqual(names(nearHundred(list)), ['Casi'])
    })

    it('lo que falta según HowLongToBeat (o SteamSpy)', () => {
        assert.equal(remainingMinutes(game({ playtime_forever: 120, hltb_main: 600 })), 480)
        assert.equal(remainingMinutes(game({ playtime_forever: 900, hltb_main: 600 })), 0)
        assert.equal(remainingMinutes(game({ playtime_forever: 60, steamspy_median_forever: 100 })), 40)
        assert.equal(remainingMinutes(game({ playtime_forever: 60 })), null)
    })

    it('actividad reciente: logros y completados mezclados por fecha', () => {
        const a = game({ name: 'A', status: 'completado', completed_at: '2026-10-20T10:00:00Z', rating: 8 })
        const b = game({ name: 'B' })
        const unlock = (appid: number, at: string | null) => ({ appid, display_name: 'L', icon: null, global_percent: 5, unlocktime: at })
        const out = recentActivity([unlock(b.appid, '2026-10-22T00:00:00Z'), unlock(b.appid, '2026-10-18T00:00:00Z'), unlock(b.appid, null)], [a, b])
        assert.deepEqual(out.map((x) => [x.kind, x.game]), [['logro', 'B'], ['completado', 'A'], ['logro', 'B']])
        assert.equal(recentActivity([], [a, b], 0).length, 0)
    })

    it('resumen del año', () => {
        const now = new Date('2026-10-25T12:00:00Z')
        const list = [
            game({ status: 'completado', completed_at: '2026-03-01T00:00:00Z', rating: 8 }),
            game({ status: 'completado', completed_at: '2026-05-01T00:00:00Z', rating: 7 }),
            game({ status: 'completado', completed_at: '2026-06-01T00:00:00Z' }),
            game({ status: 'completado', completed_at: '2025-12-01T00:00:00Z', rating: 2 }),
            game({ achievements_total: 5, achievements_unlocked: 5, last_unlock_at: '2026-02-01T00:00:00Z' }),
            game({ achievements_total: 5, achievements_unlocked: 5, last_unlock_at: '2025-02-01T00:00:00Z' }),
        ]
        assert.deepEqual(yearSummary(list, 40, 600, now), { year: 2026, completed: 3, perfect: 1, unlocks: 40, minutes: 600, averageRating: 7.5 })
        assert.equal(yearSummary([], 0, 0, now).averageRating, null)
    })

    it('estado del JUDI de hoy', () => {
        assert.equal(judiTodayState(false, { completado: true }), 'sin_juego')
        assert.equal(judiTodayState(true, null), 'pendiente')
        assert.equal(judiTodayState(true, { fase1: false }), 'pendiente')
        assert.equal(judiTodayState(true, { fase2: true }), 'en_curso')
        assert.equal(judiTodayState(true, { fase1: true, completado: true }), 'acertado')
        assert.equal(judiTodayState(true, { fase6: true }), 'fallado')
    })

    it('racha de JUDI como en /judi', () => {
        const d = (fecha: string, completado = true, perdido = false) => ({ fecha, completado, perdido })
        // Hoy sin jugar no rompe la racha.
        assert.equal(judiStreak([d('25-10-2026', false), d('24-10-2026'), d('23-10-2026'), d('22-10-2026', false, true)], '25-10-2026'), 2)
        // Hoy acertado cuenta.
        assert.equal(judiStreak([d('25-10-2026'), d('24-10-2026')], '25-10-2026'), 2)
        // Hoy fallado la rompe.
        assert.equal(judiStreak([d('25-10-2026', false, true), d('24-10-2026')], '25-10-2026'), 0)
        // El orden de entrada da igual (fechas DD-MM-YYYY).
        assert.equal(judiStreak([d('30-09-2026'), d('01-10-2026', false), d('02-10-2026')], '02-10-2026'), 1)
    })

    it('función RPC inexistente: PGRST202, 42883 o el mensaje de PostgREST', () => {
        assert.equal(isMissingRpc({ code: 'PGRST202', message: 'Could not find the function public.hubgames_judi_today' }), true)
        assert.equal(isMissingRpc({ code: '42883', message: 'function does not exist' }), true)
        assert.equal(isMissingRpc({ code: null, message: 'Could not find the function x without parameters in the schema cache' }), true)
        assert.equal(isMissingRpc({ code: '42501', message: 'permission denied' }), false)
        assert.equal(isMissingRpc(null), false)
    })
})

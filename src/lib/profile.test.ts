import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    adminLines,
    adminWhen,
    beatPercent,
    judiDateLong,
    judiDay,
    judiStats,
    memberSince,
    scheduledDaysLeft,
    scheduledTone,
    steamNeedsFix,
    steamState,
    timeAgo,
    topWithSelf,
} from './profile'

describe('perfil', () => {
    it('«En HubGames desde»: mes y año en Madrid', () => {
        assert.equal(memberSince('2025-03-14T10:00:00Z'), 'marzo de 2025')
        // 31 dic a las 23:30 UTC ya es 1 de enero en Madrid
        assert.equal(memberSince('2025-12-31T23:30:00Z'), 'enero de 2026')
        assert.equal(memberSince(null), null)
        assert.equal(memberSince('no es una fecha'), null)
    })

    it('estado de Steam a partir de la visibilidad', () => {
        assert.equal(steamState(null), 'none')
        assert.equal(steamState({ visibility: 'publico' }), 'ok')
        assert.equal(steamState({ visibility: 'privado' }), 'privado')
        assert.equal(steamState({ visibility: 'detalles_privados' }), 'detalles')
        assert.equal(steamState({ visibility: 'desconocida' }), 'desconocida')
        assert.equal(steamNeedsFix('privado'), true)
        assert.equal(steamNeedsFix('detalles'), true)
        assert.equal(steamNeedsFix('desconocida'), false)
        assert.equal(steamNeedsFix('ok'), false)
    })

    it('hace cuánto: solo pasado', () => {
        const now = Date.parse('2026-10-28T12:00:00Z')
        assert.equal(timeAgo('2026-10-28T11:59:40Z', now), 'hace un momento')
        assert.equal(timeAgo('2026-10-28T10:00:00Z', now), 'hace 2 horas')
        assert.equal(timeAgo('2026-10-27T12:00:00Z', now), 'ayer')
        assert.equal(timeAgo('2026-10-28T12:05:00Z', now), 'hace un momento')
    })

    it('cifras de JUDI: aciertos, fallos, precisión y puntos', () => {
        const rows = [
            { completado: true, fase1: false },
            { completado: true, fase1: true, fase2: true },
            { completado: false, fase1: true, fase2: true, fase3: true, fase4: true, fase5: true, fase6: true },
            { completado: false, fase1: true }, // a medias: no cuenta
        ]
        assert.deepEqual(judiStats(rows), { aciertos: 2, fallos: 1, total: 3, precision: 67, puntos: 6 + 4 })
        assert.deepEqual(judiStats([]), { aciertos: 0, fallos: 0, total: 0, precision: 0, puntos: 0 })
    })

    it('«Superas al N %»', () => {
        assert.equal(beatPercent(3, 14), 85)
        assert.equal(beatPercent(1, 14), 100)
        assert.equal(beatPercent(14, 14), 0)
        assert.equal(beatPercent(1, 1), null)
        assert.equal(beatPercent(null, 14), null)
    })

    it('top 5 y tu fila fuera del top', () => {
        const ranking = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((userId) => ({ userId }))
        const inTop = topWithSelf(ranking, 'c')
        assert.equal(inTop.top.length, 5)
        assert.equal(inTop.self, null)
        assert.equal(inTop.rank, 3)
        const outside = topWithSelf(ranking, 'h')
        assert.deepEqual(outside.self, { entry: { userId: 'h' }, rank: 8 })
        const absent = topWithSelf(ranking, 'z')
        assert.equal(absent.self, null)
        assert.equal(absent.rank, null)
        assert.deepEqual(topWithSelf([], 'a'), { top: [], self: null, rank: null })
    })

    it('programados: días que quedan y su color', () => {
        assert.equal(scheduledDaysLeft('03-11-2026', '28-10-2026'), 6)
        assert.equal(scheduledDaysLeft('28-10-2026', '28-10-2026'), 0)
        assert.equal(scheduledDaysLeft('20-10-2026', '28-10-2026'), 0)
        assert.equal(scheduledDaysLeft(null, '28-10-2026'), 0)
        assert.equal(scheduledTone(6), 'dash-ok')
        assert.equal(scheduledTone(3), 'dash-ok')
        assert.equal(scheduledTone(2), 'dash-warn')
        assert.equal(scheduledTone(1), 'dash-warn')
        assert.equal(scheduledTone(0), 'dash-ko')
        assert.equal(judiDateLong('03-11-2026'), '3 de noviembre')
    })

    it('fechas de administración en hora de Madrid', () => {
        const now = new Date('2026-10-28T12:00:00Z')
        assert.equal(judiDay(now), '28-10-2026')
        assert.equal(judiDay(new Date('2026-10-28T23:30:00Z')), '29-10-2026')
        assert.equal(adminWhen('2026-10-28T05:00:00Z', now), 'hoy, 06:00')
        assert.equal(adminWhen('2026-10-27T05:00:00Z', now), 'ayer, 06:00')
        assert.equal(adminWhen('2026-10-24T04:00:00Z', now), '24 oct, 06:00')
    })

    it('tarjeta de administración: tres líneas con su color', () => {
        const now = new Date('2026-10-28T12:00:00Z')
        const ok = adminLines(
            { lastGen: { exito: true, fecha_ejecucion: '2026-10-28T05:00:00Z', nombre_juego: 'Hollow Knight', error_mensaje: null }, lastScheduled: '03-11-2026', syncErrors: 0 },
            now,
        )
        assert.deepEqual(
            ok.map((l) => [l.key, l.tone, l.value, l.detail]),
            [
                ['gen', 'dash-ok', 'Correcto', 'hoy, 06:00 · Hollow Knight'],
                ['scheduled', 'dash-ok', '6 días', 'Hasta el 3 de noviembre'],
                ['sync', 'dash-ok', 'Ninguna con error', undefined],
            ],
        )
        const bad = adminLines(
            { lastGen: { exito: false, fecha_ejecucion: '2026-10-28T05:00:00Z', nombre_juego: null, error_mensaje: 'Sin juegos elegibles' }, lastScheduled: '29-10-2026', syncErrors: 3 },
            now,
        )
        assert.deepEqual(
            bad.map((l) => [l.tone, l.value]),
            [
                ['dash-ko', 'Fallido'],
                ['dash-warn', '1 día'],
                ['dash-ko', '3 con error'],
            ],
        )
        assert.equal(bad[0].detail, 'hoy, 06:00 · Sin juegos elegibles')
        const none = adminLines({ lastGen: null, lastScheduled: null, syncErrors: 0 }, now)
        assert.deepEqual(
            none.map((l) => [l.tone, l.value]),
            [
                ['dash-warn', 'Sin registros'],
                ['dash-ko', 'Ninguno después de hoy'],
                ['dash-ok', 'Ninguna con error'],
            ],
        )
    })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    achievementsLevel,
    buildHeatmap,
    dayLabel,
    dayLevel,
    heatmapStart,
    heatmapSummary,
    hoursLevel,
    madridDate,
} from './activity-heatmap'

describe('mapa de actividad', () => {
    it('empieza en lunes y cubre 53 semanas hasta la de hoy', () => {
        // 25/10/2026 es domingo: la última columna va del 19 al 25 y la primera, 52 semanas antes.
        assert.equal(heatmapStart('2026-10-25'), '2025-10-20')
        // 21/10/2026 es miércoles: misma semana, mismo inicio.
        assert.equal(heatmapStart('2026-10-21'), '2025-10-20')
        assert.equal(heatmapStart('2026-10-26', 1), '2026-10-26')
    })

    it('niveles de horas y de logros', () => {
        assert.deepEqual([0, 30, 59, 60, 119, 120, 239, 240, 600].map(hoursLevel), [0, 1, 1, 2, 2, 3, 3, 4, 4])
        assert.deepEqual([0, 1, 2, 3, 4, 7, 8, 30].map(achievementsLevel), [0, 1, 2, 2, 3, 3, 4, 4])
    })

    it('mandan las horas; sin horas, los logros', () => {
        assert.deepEqual(dayLevel(30, 10), { level: 1, basis: 'horas' })
        assert.deepEqual(dayLevel(0, 10), { level: 4, basis: 'logros' })
        assert.deepEqual(dayLevel(0, 0), { level: 0, basis: null })
    })

    it('logros por día de Madrid', () => {
        // 23:30 UTC del 24/10 ya es 25/10 en Madrid (UTC+2 en octubre hasta el 25).
        assert.equal(madridDate('2026-10-24T23:30:00Z'), '2026-10-25')
        assert.equal(madridDate('2026-01-10T22:30:00Z'), '2026-01-10')
    })

    it('agrega horas de varios juegos y logros, y deja en blanco lo que no ha llegado', () => {
        const map = buildHeatmap({
            today: '2026-10-21',
            playtime: [
                { date: '2026-10-20', minutes: 50 },
                { date: '2026-10-20', minutes: 40 },
                { date: '2026-10-19', minutes: null },
                { date: null, minutes: 100 },
                // Fuera del rango: no cuenta.
                { date: '2025-01-01', minutes: 500 },
            ],
            unlocks: ['2026-10-20T10:00:00Z', '2026-03-03T10:00:00Z', '2026-03-03T11:00:00Z', null],
        })
        assert.equal(map.days.length, 53 * 7)
        assert.equal(map.from, '2025-10-20')
        const byDate = new Map(map.days.map((d) => [d.date, d]))
        assert.deepEqual(byDate.get('2026-10-20'), { date: '2026-10-20', minutes: 90, achievements: 1, level: 2, basis: 'horas', future: false })
        assert.deepEqual(byDate.get('2026-03-03'), { date: '2026-03-03', minutes: 0, achievements: 2, level: 2, basis: 'logros', future: false })
        assert.equal(byDate.get('2026-10-22')?.future, true)
        assert.equal(map.days.at(-1)?.date, '2026-10-25')
        assert.deepEqual(map.totals, { minutes: 90, achievements: 3, activeDays: 2 })
    })

    it('etiquetas de mes donde empieza cada uno, sin amontonarse', () => {
        const map = buildHeatmap({ today: '2026-10-25', playtime: [], unlocks: [] })
        // La primera columna (20/10/2025) es octubre, pero noviembre empieza dos semanas después: no cabe.
        assert.equal(map.months[0].label, 'nov')
        assert.equal(map.months[0].week, 2)
        assert.ok(map.months.every((m, i) => i === 0 || m.week - map.months[i - 1].week >= 3))
        assert.equal(map.months.at(-1)?.label, 'oct')
    })

    it('textos del tooltip y resumen', () => {
        assert.equal(dayLabel({ date: '2026-10-24', minutes: 150, achievements: 3 }), '24 oct 2026 · 2,5 h · 3 logros')
        assert.equal(dayLabel({ date: '2026-10-24', minutes: 45, achievements: 1 }), '24 oct 2026 · 45 min · 1 logro')
        assert.equal(dayLabel({ date: '2026-10-24', minutes: 0, achievements: 0 }), '24 oct 2026 · sin actividad')
        const empty = buildHeatmap({ today: '2026-10-25', playtime: [], unlocks: [] })
        assert.match(heatmapSummary(empty), /^Sin actividad registrada/)
        const map = buildHeatmap({ today: '2026-10-25', playtime: [{ date: '2026-10-20', minutes: 120 }], unlocks: ['2026-05-03T10:00:00Z'] })
        assert.equal(
            heatmapSummary(map),
            'Del 20 oct 2025 al 25 oct 2026: 2 días con actividad, 2 h registradas, 1 logro. Día más activo: 20 oct 2026 · 2 h.',
        )
    })
})

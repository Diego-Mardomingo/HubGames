import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { countsByMonth, goalPace, monthElapsed, monthKey, monthName, previousMonths, progressFor, suggestTargets } from './goals'
import { libraryGame as game } from './test-utils'

describe('metas mensuales', () => {
    it('mes en hora de Madrid', () => {
        assert.equal(monthKey('2026-10-25T12:00:00Z'), '2026-10-01')
        // 31/10 23:30 UTC ya es noviembre en Madrid.
        assert.equal(monthKey('2026-10-31T23:30:00Z'), '2026-11-01')
        assert.equal(monthName('2026-10-01'), 'octubre')
        assert.deepEqual(previousMonths('2026-02-01', 3), ['2026-01-01', '2025-12-01', '2025-11-01'])
    })

    it('progreso del mes a partir de los datos sincronizados', () => {
        const counts = countsByMonth(
            [
                game({ status: 'completado', completed_at: '2026-10-03T10:00:00Z' }),
                game({ status: 'completado', completed_at: '2026-09-03T10:00:00Z' }),
                game({ status: 'abandonado', completed_at: '2026-10-03T10:00:00Z' }),
                game({ status: 'ya_jugado', completed_at: '2026-10-03T10:00:00Z' }),
                game({ status: 'otros', completed_at: '2026-10-03T10:00:00Z' }),
                game({ achievements_total: 4, achievements_unlocked: 4, last_unlock_at: '2026-10-10T10:00:00Z' }),
                game({ achievements_total: 4, achievements_unlocked: 3, last_unlock_at: '2026-10-10T10:00:00Z' }),
            ],
            ['2026-10-01T10:00:00Z', '2026-10-02T10:00:00Z', '2026-09-30T10:00:00Z'],
        )
        assert.deepEqual(progressFor(counts, '2026-10-01'), { completar: 1, logros: 2, perfectos: 1 })
        assert.deepEqual(progressFor(counts, '2026-08-01'), { completar: 0, logros: 0, perfectos: 0 })
    })

    it('propuesta según tu media de los últimos 6 meses', () => {
        const unlocks = [
            ...Array.from({ length: 120 }, () => '2026-09-15T10:00:00Z'),
            ...Array.from({ length: 60 }, () => '2026-05-15T10:00:00Z'),
            // El mes en curso no cuenta para la media.
            ...Array.from({ length: 500 }, () => '2026-10-15T10:00:00Z'),
        ]
        const games = [
            ...['2026-09-01', '2026-08-01', '2026-07-01', '2026-06-01', '2026-05-01', '2026-04-01', '2026-04-02'].map((d) =>
                game({ status: 'completado', completed_at: `${d}T12:00:00Z` }),
            ),
        ]
        // completar: 7/6 × 1,1 → 2; logros: 180/6 = 30 × 1,1 = 33 → 35; perfectos: sin ninguno → 1.
        assert.deepEqual(suggestTargets(countsByMonth(games, unlocks), '2026-10-01'), { completar: 2, logros: 35, perfectos: 1 })
        assert.deepEqual(suggestTargets(countsByMonth([], []), '2026-10-01'), { completar: 1, logros: 5, perfectos: 1 })
    })

    it('ritmo: cumplida, al día o por detrás', () => {
        const mid = monthElapsed('2026-10-01', new Date('2026-10-16T10:00:00Z'))
        assert.ok(mid > 0.5 && mid < 0.53)
        assert.equal(monthElapsed('2026-09-01', new Date('2026-10-16T10:00:00Z')), 1)
        assert.equal(goalPace(2, 2, 0.1), 'cumplida')
        assert.equal(goalPace(25, 50, 0.5), 'al_dia')
        assert.equal(goalPace(10, 50, 0.5), 'por_detras')
        assert.equal(goalPace(0, 1, 0.9), 'al_dia')
    })
})

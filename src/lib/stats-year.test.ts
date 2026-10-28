import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { yearStats, type StatsInput, type StatsUnlock } from './stats'
import { listsOfYear, monthsElapsed, ratingTierCounts, summaryDiff, unlocksByMonthRarity, yearSummary, yearView } from './stats-year'
import { libraryGame as game } from './test-utils'

function unlock(appid: number, unlocktime: string, global_percent: number | null = 50, description: string | null = null): StatsUnlock {
    return { appid, unlocktime, global_percent, display_name: `Logro ${unlocktime}`, icon: null, description }
}

const NOW = new Date('2026-10-28T10:00:00Z')

describe('vista de /estadisticas', () => {
    it('meses que han llegado, en hora de Madrid', () => {
        assert.equal(monthsElapsed(2025, NOW), 12)
        assert.equal(monthsElapsed(2026, NOW), 10)
        assert.equal(monthsElapsed(2027, NOW), 0)
        // 31/12 23:30 UTC ya es enero en Madrid.
        assert.equal(monthsElapsed(2026, new Date('2025-12-31T23:30:00Z')), 1)
    })

    it('logros por mes y rareza; los meses que no han llegado van a null', () => {
        const months = unlocksByMonthRarity(
            { unlocks: [unlock(1, '2026-01-05T10:00:00Z', 0.5), unlock(1, '2026-01-06T10:00:00Z', 30), unlock(1, '2026-03-01T10:00:00Z', null)] },
            2026,
            NOW,
        )
        assert.equal(months.length, 12)
        assert.equal(months[0]?.total, 2)
        assert.equal(months[0]?.tiers.leg, 1)
        assert.equal(months[0]?.tiers.poco, 1)
        assert.equal(months[1]?.total, 0)
        assert.equal(months[2]?.unknown, 1)
        assert.equal(months[9]?.total, 0)
        assert.equal(months[10], null)
        assert.equal(months[11], null)
    })

    it('lista de hoy de los juegos con actividad, en el orden de las listas', () => {
        const games = [game({ appid: 1, status: 'completado' }), game({ appid: 2, status: 'jugando' }), game({ appid: 3, status: 'jugando' }), game({ appid: 4, status: 'pendiente' })]
        assert.deepEqual(listsOfYear(games, [1, 2, 3]), [
            { status: 'jugando', count: 2 },
            { status: 'completado', count: 1 },
        ])
    })

    it('notas por nivel con los umbrales de ratingTier', () => {
        assert.deepEqual(ratingTierCounts([9, 9.5, 8.5, 5, 4.5, null]), { top: 2, good: 1, mid: 1, bad: 1 })
    })

    it('diferencias con el año anterior; sin ese año, null', () => {
        const a = { completed: 5, hours: 100, unlocks: 40, perfect: 1, averageRating: 8.1 }
        const b = { completed: 3, hours: 120, unlocks: 40, perfect: 0, averageRating: null }
        assert.deepEqual(summaryDiff(a, b), { completed: 2, hours: -20, unlocks: 0, perfect: 1, averageRating: null })
        assert.deepEqual(summaryDiff(a, null), { completed: null, hours: null, unlocks: null, perfect: null, averageRating: null })
    })

    it('el histograma agrupa por abajo: 4,5 es «Flojo» y va a la columna 4', () => {
        const input: StatsInput = {
            games: [
                game({ appid: 1, status: 'completado', completed_at: '2026-02-10T10:00:00Z', rating: 4.5 }),
                game({ appid: 2, status: 'completado', completed_at: '2026-02-11T10:00:00Z', rating: 9.5 }),
            ],
            unlocks: [],
            daily: [],
            historyStart: null,
        }
        const s = yearStats(input, 2026)
        assert.equal(s.ratingHistogram[4], 1)
        assert.equal(s.ratingHistogram[5], 0)
        assert.equal(s.ratingHistogram[9], 1)
    })

    it('vista completa: completados con horas y Favorito, top con su lista, reparto y logro más raro', () => {
        const input: StatsInput = {
            games: [
                game({ appid: 1, name: 'Hades', status: 'completado', completed_at: '2026-02-08T10:00:00Z', rating: 9.5, playtime_forever: 5760, favorite: true }),
                game({ appid: 2, name: 'Balatro', status: 'rejugable', playtime_forever: 600 }),
            ],
            unlocks: [unlock(1, '2026-02-01T10:00:00Z', 0.4, 'Escapa con 32 de calor.'), unlock(2, '2026-03-01T10:00:00Z', 12)],
            daily: [],
            historyStart: null,
        }
        const v = yearView(input, yearStats(input, 2026), NOW)
        assert.deepEqual(v.summary, yearSummary(yearStats(input, 2026)))
        assert.equal(v.summary.hours, 106)
        assert.deepEqual(v.completed.map((g) => [g.appid, g.minutes, g.favorite]), [[1, 5760, true]])
        assert.deepEqual(v.top.map((g) => [g.appid, g.status]), [
            [1, 'completado'],
            [2, 'rejugable'],
        ])
        assert.deepEqual(v.lists, [
            { status: 'rejugable', count: 1 },
            { status: 'completado', count: 1 },
        ])
        assert.equal(v.rarity.total, 2)
        assert.equal(v.rarity.tiers.leg, 1)
        assert.equal(v.rarity.tiers.rara, 1)
        assert.equal(v.ratingTiers.top, 1)
        assert.equal(v.rarest?.game, 'Hades')
        assert.equal(v.rarest?.description, 'Escapa con 32 de calor.')
        assert.equal(v.months[10], null)
    })
})

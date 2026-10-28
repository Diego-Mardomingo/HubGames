import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { StatsInput, StatsUnlock } from './stats'
import {
    buildWrappedView,
    dayLong,
    formatRating,
    hoursEquivalents,
    monthlyMinutes,
    otherYearWithData,
    rarityCounts,
    shareOfYear,
    streakSquares,
    unlocksByGame,
    yearChoices,
    yearSpan,
} from './wrapped'
import { libraryGame as game } from './test-utils'

function unlock(appid: number, unlocktime: string, global_percent: number | null = 50): StatsUnlock {
    return { appid, unlocktime, global_percent, display_name: `Logro ${unlocktime}`, icon: null, description: 'Hazlo' }
}

describe('resumen anual (Wrapped)', () => {
    it('horas por mes con el historial diario del año', () => {
        const months = monthlyMinutes(
            [
                { appid: 1, date: '2025-01-03', minutes: 60 },
                { appid: 2, date: '2025-01-20', minutes: 30 },
                { appid: 1, date: '2025-08-01', minutes: 120 },
                { appid: 1, date: '2024-08-01', minutes: 999 },
                { appid: 1, date: '2025-09-01', minutes: -5 },
            ],
            2025,
        )
        assert.equal(months.length, 12)
        assert.equal(months[0], 90)
        assert.equal(months[7], 120)
        assert.equal(months[8], 0)
    })

    it('logros del año por rareza, de común a legendaria y sin las vacías', () => {
        const counts = rarityCounts(
            [unlock(1, '2025-03-01T10:00:00Z', 0.4), unlock(1, '2025-03-02T10:00:00Z', 60), unlock(1, '2025-03-03T10:00:00Z', 70), unlock(1, '2025-03-04T10:00:00Z', null), unlock(1, '2024-03-04T10:00:00Z', 0.1)],
            2025,
        )
        assert.deepEqual(counts, [
            { tier: 'comun', count: 2 },
            { tier: 'leg', count: 1 },
        ])
    })

    it('logros del año por juego', () => {
        const m = unlocksByGame([unlock(1, '2025-01-01T10:00:00Z'), unlock(1, '2025-02-01T10:00:00Z'), unlock(2, '2024-02-01T10:00:00Z')], 2025)
        assert.equal(m.get(1), 2)
        assert.equal(m.has(2), false)
    })

    it('un año pasado cuenta entero; el actual, hasta hoy', () => {
        assert.deepEqual(yearSpan(2024, '2026-10-28'), { days: 366, through: null })
        assert.deepEqual(yearSpan(2025, '2026-10-28'), { days: 365, through: null })
        assert.deepEqual(yearSpan(2026, '2026-01-01'), { days: 1, through: '2026-01-01' })
        assert.deepEqual(yearSpan(2026, '2026-10-28'), { days: 301, through: '2026-10-28' })
    })

    it('equivalencias: al día y días enteros', () => {
        assert.deepEqual(hoursEquivalents(912 * 60, 365), { perDay: '2,5 h', wholeDays: 38 })
        assert.deepEqual(hoursEquivalents(14 * 60, 365), { perDay: '2 min', wholeDays: 0 })
        assert.deepEqual(hoursEquivalents(365 * 60, 365), { perDay: '1 h', wholeDays: 15 })
        assert.deepEqual(hoursEquivalents(5, 365), { perDay: '1 min', wholeDays: 0 })
    })

    it('parte del año de un juego', () => {
        assert.equal(shareOfYear(214, 912), 23)
        assert.equal(shareOfYear(10, 0), 0)
    })

    it('selector de año: los 5 más recientes y el resto en «Más»; el elegido siempre a la vista', () => {
        const years = [2026, 2025, 2024, 2023, 2022, 2021, 2020]
        assert.deepEqual(yearChoices(years, 2025), { shown: [2026, 2025, 2024, 2023, 2022], more: [2021, 2020] })
        assert.deepEqual(yearChoices(years, 2020), { shown: [2026, 2025, 2024, 2023, 2020], more: [2022, 2021] })
        assert.deepEqual(yearChoices([2026, 2025], 2026), { shown: [2026, 2025], more: [] })
    })

    it('cuadrados de la racha: hasta 31 y el resto con +N', () => {
        assert.deepEqual(streakSquares(23), { shown: 23, extra: 0 })
        assert.deepEqual(streakSquares(40), { shown: 31, extra: 9 })
        assert.deepEqual(streakSquares(0), { shown: 0, extra: 0 })
    })

    it('día en largo', () => {
        assert.equal(dayLong('2026-10-28'), '28 de octubre')
    })

    it('nota con coma y sin «,0»', () => {
        assert.equal(formatRating(9.5), '9,5')
        assert.equal(formatRating(10), '10')
    })

    it('el top lleva lista, marcas, nota, Metacritic y logros del año; meses solo con horas medidas', () => {
        const input: StatsInput = {
            games: [
                game({ appid: 1, name: 'A', status: 'completado', favorite: true, rating: 9.5, metacritic_score: 94, completed_at: '2025-05-01T10:00:00Z' }),
                game({ appid: 2, name: 'B', status: 'jugando', endless: true }),
            ],
            unlocks: [unlock(1, '2025-03-01T10:00:00Z', 0.5), unlock(1, '2025-03-02T10:00:00Z', 20), unlock(2, '2025-04-01T10:00:00Z', 50)],
            daily: [
                { appid: 1, date: '2025-03-01', minutes: 300 },
                { appid: 2, date: '2025-04-01', minutes: 60 },
            ],
            historyStart: '2024-12-01',
        }
        const w = buildWrappedView(input, 2025, new Date('2026-10-28T12:00:00Z'))
        assert.deepEqual(
            w.top.map((g) => [g.appid, g.status, g.favorite, g.endless, g.rating, g.metacritic, g.unlocks]),
            [
                [1, 'completado', true, false, 9.5, 94, 2],
                [2, 'jugando', false, true, null, null, 1],
            ],
        )
        assert.equal(w.months?.[2], 300)
        assert.equal(w.rarest?.description, 'Hazlo')
        assert.deepEqual(w.rarity.map((r) => r.tier), ['comun', 'poco', 'leg'])
        assert.equal(w.averageRating, 9.5)
        assert.deepEqual(w.completedGames.map((g) => g.appid), [1])
        assert.equal(w.through, null)
        assert.equal(w.days, 365)

        const approx = buildWrappedView({ ...input, historyStart: null }, 2025, new Date('2026-10-28T12:00:00Z'))
        assert.equal(approx.months, null)
        const current = buildWrappedView(input, 2026, new Date('2026-10-28T12:00:00Z'))
        assert.equal(current.through, '2026-10-28')
    })

    it('otro año con algo que resumir para el vacío', () => {
        const input: StatsInput = { games: [], unlocks: [unlock(1, '2024-03-01T10:00:00Z')], daily: [], historyStart: null }
        assert.equal(otherYearWithData(input, [2026, 2025, 2024], 2026), 2024)
        assert.equal(otherYearWithData(input, [2026, 2024], 2024), null)
    })
})

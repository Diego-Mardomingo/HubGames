import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { countByDay, dayKey, groupTimeline, heatLevel, heatmapWeeks, streaks, yearsWithUnlocks } from './achievement-history'

/** ISO de una hora local concreta, para que los tests no dependan de la zona horaria. */
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString()

function unlock(appid: number, unlocktime: string | null, achieved = true) {
    return { appid, achieved, unlocktime, apiname: `${appid}-${unlocktime}` }
}

describe('dayKey', () => {
    it('día local con ceros', () => {
        assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05')
    })
})

describe('countByDay', () => {
    it('cuenta solo desbloqueados con fecha', () => {
        const counts = countByDay([unlock(1, at(2026, 3, 1, 9)), unlock(2, at(2026, 3, 1, 22)), unlock(1, at(2026, 3, 2)), unlock(1, null), unlock(1, at(2026, 3, 2), false)])
        assert.deepEqual([...counts], [['2026-03-01', 2], ['2026-03-02', 1]])
    })
})

describe('groupTimeline', () => {
    it('por día y juego, lo más reciente primero', () => {
        const list = [unlock(1, at(2026, 3, 1, 9)), unlock(2, at(2026, 3, 1, 20)), unlock(1, at(2026, 3, 1, 21)), unlock(3, at(2026, 3, 4))]
        const days = groupTimeline(list)
        assert.deepEqual(
            days.map((d) => [d.day, d.games.map((g) => [g.appid, g.achievements.length])]),
            [
                ['2026-03-04', [[3, 1]]],
                ['2026-03-01', [[1, 2], [2, 1]]],
            ],
        )
    })
})

describe('heatmapWeeks', () => {
    it('semanas de lunes a domingo que cubren el año', () => {
        // 2026 empieza en jueves y acaba en jueves.
        const weeks = heatmapWeeks(2026, new Map([['2026-01-01', 3]]))
        assert.equal(weeks.length, 53)
        assert.ok(weeks.every((w) => w.length === 7))
        assert.deepEqual(weeks[0][0], { day: '2025-12-29', count: 0, inYear: false })
        assert.deepEqual(weeks[0][3], { day: '2026-01-01', count: 3, inYear: true })
        assert.equal(weeks[52][6].day, '2027-01-03')
        assert.equal(weeks.flat().filter((c) => c.inYear).length, 365)
    })
})

describe('heatLevel', () => {
    it('tramos de intensidad', () => {
        assert.deepEqual([0, 1, 2, 3, 4, 7, 8, 50].map(heatLevel), [0, 1, 2, 2, 3, 3, 4, 4])
    })
})

describe('streaks', () => {
    const days = ['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-05', '2026-03-09', '2026-03-10']

    it('mejor racha cruzando meses', () => {
        assert.deepEqual(streaks(days, new Date(2026, 5, 1)).best, { length: 3, start: '2026-02-27', end: '2026-03-01' })
    })

    it('la actual sigue viva si el último día es hoy o ayer', () => {
        assert.deepEqual(streaks(days, new Date(2026, 2, 11, 8)).current, { length: 2, start: '2026-03-09', end: '2026-03-10' })
        assert.equal(streaks(days, new Date(2026, 2, 10, 8)).current.length, 2)
        assert.equal(streaks(days, new Date(2026, 2, 12, 8)).current.length, 0)
    })

    it('sin días', () => {
        assert.deepEqual(streaks([], new Date()), { current: { length: 0, start: null, end: null }, best: { length: 0, start: null, end: null } })
    })
})

describe('yearsWithUnlocks', () => {
    it('años distintos, del más reciente al más antiguo', () => {
        assert.deepEqual(yearsWithUnlocks(new Map([['2024-05-01', 1], ['2026-01-01', 2], ['2024-07-01', 1]])), [2026, 2024])
    })
})

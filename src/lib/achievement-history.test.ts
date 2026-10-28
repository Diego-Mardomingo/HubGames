import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    busiestDay,
    byMonth,
    countByDay,
    daySummary,
    dayKey,
    groupTimeline,
    heatLevel,
    heatmapWeeks,
    milestonesByDay,
    monthSummary,
    notableRarities,
    perfectDays,
    streakAtRisk,
    streakIndex,
    streaks,
    tallyRarity,
    yearHeatmap,
    yearSummary,
    yearsWithUnlocks,
} from './achievement-history'

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

function rated(appid: number, unlocktime: string | null, global_percent: number | null, apiname = `${appid}-${unlocktime}-${global_percent}`) {
    return { appid, achieved: true, unlocktime, global_percent, apiname }
}

describe('byMonth', () => {
    it('agrupa días seguidos del mismo mes sin cambiar el orden', () => {
        const months = byMonth([{ day: '2026-10-28' }, { day: '2026-10-02' }, { day: '2026-09-30' }, { day: '2025-09-01' }])
        assert.deepEqual(
            months.map((m) => [m.month, m.days.length]),
            [['2026-10', 2], ['2026-09', 1], ['2025-09', 1]],
        )
    })
})

describe('tallyRarity y notableRarities', () => {
    it('cuenta por rareza sin los que no tienen %', () => {
        const t = tallyRarity([{ global_percent: 0.5 }, { global_percent: 3 }, { global_percent: 10 }, { global_percent: 12 }, { global_percent: 60 }, { global_percent: null }])
        assert.deepEqual(t, { comun: 1, poco: 0, rara: 2, epica: 1, leg: 1 })
    })

    it('nombra legendarias, épicas y raras en singular o plural', () => {
        assert.deepEqual(
            notableRarities({ comun: 4, poco: 2, rara: 2, epica: 1, leg: 0 }).map((r) => r.label),
            ['1 épica', '2 raras'],
        )
        assert.deepEqual(notableRarities({ comun: 4, poco: 2, rara: 0, epica: 0, leg: 0 }), [])
    })
})

describe('daySummary y monthSummary', () => {
    const days = groupTimeline([
        rated(1, at(2026, 10, 27, 9), 50),
        rated(1, at(2026, 10, 27, 10), 3),
        rated(2, at(2026, 10, 27, 11), null),
        rated(2, at(2026, 10, 25), 10),
        rated(2, at(2026, 10, 24), 20),
    ])

    it('un día: logros, puntos y la rareza más alta', () => {
        const s = daySummary(days[0])
        assert.equal(s.total, 3)
        // 50 % = 3 pts, 3 % = 15 pts, sin % = 1 pt.
        assert.equal(s.points, 19)
        assert.equal(s.top, 'epica')
    })

    it('un mes: días y juegos del que más tiene al que menos', () => {
        const s = monthSummary(days)
        assert.equal(s.total, 5)
        assert.equal(s.days, 3)
        assert.deepEqual(s.games, [2, 1])
        assert.equal(s.tiers.rara, 1)
    })

    it('sin % global, sin rareza más alta', () => {
        assert.equal(daySummary({ day: '2026-01-01', games: [{ appid: 1, achievements: [{ appid: 1, global_percent: null }] }] }).top, null)
    })
})

describe('busiestDay y yearSummary', () => {
    const counts = new Map([['2026-03-14', 14], ['2026-10-27', 5], ['2026-10-28', 14], ['2025-08-14', 30]])

    it('el día con más logros del año; si empatan, el más reciente', () => {
        assert.deepEqual(busiestDay(counts, 2026), { day: '2026-10-28', count: 14 })
        assert.deepEqual(busiestDay(counts, 2025), { day: '2025-08-14', count: 30 })
        assert.equal(busiestDay(counts, 2024), null)
    })

    it('logros, días y el más raro del año con su día', () => {
        const list = [rated(1, at(2026, 2, 3, 22), 0.4), rated(2, at(2025, 8, 14), 0.1), rated(3, at(2026, 10, 1), 2), rated(4, at(2026, 1, 1), null)]
        const y = yearSummary(list, countByDay(list), 2026)
        assert.equal(y.total, 3)
        assert.equal(y.days, 3)
        assert.equal(y.rarest?.appid, 1)
        assert.equal(y.rarest?.day, '2026-02-03')
        assert.equal(yearSummary(list, countByDay(list), 2024).rarest, null)
    })
})

describe('streakAtRisk y streakIndex', () => {
    const current = { length: 3, start: '2026-10-25', end: '2026-10-27' }

    it('en riesgo si la racha acabó ayer', () => {
        assert.equal(streakAtRisk(current, new Date(2026, 9, 28, 9)), true)
        assert.equal(streakAtRisk(current, new Date(2026, 9, 27, 9)), false)
        assert.equal(streakAtRisk({ length: 0, start: null, end: null }, new Date(2026, 9, 28)), false)
    })

    it('posición de un día en la racha', () => {
        assert.equal(streakIndex('2026-10-25', current), 0)
        assert.equal(streakIndex('2026-10-27', current), 2)
        assert.equal(streakIndex('2026-10-28', current), -1)
        assert.equal(streakIndex('2026-10-25', { start: null, end: null }), -1)
    })

    it('cruzando el cambio de hora', () => {
        assert.equal(streakIndex('2026-10-26', { start: '2026-10-24', end: '2026-10-27' }), 2)
    })
})

describe('perfectDays', () => {
    it('el día del último desbloqueo de los juegos con todos los logros', () => {
        const list = [rated(1, at(2026, 10, 12, 20), 5), rated(1, at(2026, 10, 9), 5), rated(2, at(2026, 10, 1), 5)]
        const games = [
            { appid: 1, achievements_total: 2, achievements_unlocked: 2 },
            { appid: 2, achievements_total: 10, achievements_unlocked: 1 },
            { appid: 3, achievements_total: 0, achievements_unlocked: 0 },
        ]
        assert.deepEqual([...perfectDays(list, games)], [[1, '2026-10-12']])
    })
})

describe('milestonesByDay', () => {
    it('agrupa los hitos por el día en que se alcanzaron', () => {
        const map = milestonesByDay([
            { id: 'a', date: at(2026, 10, 12, 9) },
            { id: 'b', date: at(2026, 10, 12, 21) },
            { id: 'c', date: null },
            { id: 'd', date: at(2025, 8, 14) },
        ])
        assert.deepEqual(
            [...map].map(([day, list]) => [day, list.map((m) => m.id)]),
            [
                ['2026-10-12', ['a', 'b']],
                ['2025-08-14', ['d']],
            ],
        )
    })
})

describe('yearHeatmap', () => {
    const counts = new Map([['2026-01-01', 3], ['2026-10-27', 9], ['2025-12-31', 2]])

    it('año en curso: relleno de otros años, días que faltan y hoy', () => {
        const map = yearHeatmap(2026, counts, new Date(2026, 9, 28, 10))
        assert.equal(map.weeks, 53)
        assert.equal(map.days.length, 53 * 7)
        assert.deepEqual(map.days[0], { date: '2025-12-29', minutes: 0, achievements: 0, level: 0, basis: null, future: false, out: true })
        // El relleno de 2025 no cuenta aunque tenga logros.
        assert.equal(map.days[2].achievements, 0)
        assert.equal(map.days[3].level, 2)
        assert.equal(map.days.find((d) => d.date === '2026-10-27')?.level, 4)
        assert.equal(map.days.find((d) => d.date === '2026-10-29')?.future, true)
        assert.equal(map.from, '2026-01-01')
        assert.equal(map.to, '2026-10-28')
        assert.equal(map.hasToday, true)
        assert.deepEqual(map.totals, { minutes: 0, achievements: 12, activeDays: 2 })
        assert.deepEqual(
            map.months.map((m) => m.label),
            ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
        )
        assert.equal(map.months[0].week, 0)
    })

    it('año pasado: sin futuro y sin hoy', () => {
        const map = yearHeatmap(2025, counts, new Date(2026, 9, 28))
        assert.equal(map.to, '2025-12-31')
        assert.equal(map.hasToday, false)
        assert.equal(map.days.some((d) => d.future), false)
        assert.equal(map.totals.achievements, 2)
    })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { approxMinutesByYear, availableYears, buildWrapped, delta, hasWrapped, madridDay, yearStats, type StatsInput, type StatsUnlock } from './stats'
import { libraryGame as game } from './test-utils'

function unlock(appid: number, unlocktime: string, global_percent: number | null = 50): StatsUnlock {
    return { appid, unlocktime, global_percent, display_name: `Logro ${unlocktime}`, icon: null }
}

describe('estadísticas por año (#32)', () => {
    it('días y años en hora de Madrid', () => {
        // 31/12 23:30 UTC ya es 1 de enero en Madrid.
        assert.equal(madridDay('2025-12-31T23:30:00Z'), '2026-01-01')
    })

    it('reparte las horas de cada juego entre los años de sus logros; sin logros, al año de la última partida', () => {
        const a = game({ appid: 1, playtime_forever: 600 })
        const b = game({ appid: 2, playtime_forever: 120, rtime_last_played: '2024-05-01T10:00:00Z' })
        const approx = approxMinutesByYear(
            [a, b],
            [unlock(1, '2023-03-01T10:00:00Z'), unlock(1, '2025-03-01T10:00:00Z'), unlock(1, '2025-04-01T10:00:00Z')],
        )
        assert.deepEqual([...approx.get(1)!.entries()].sort(), [
            [2023, 200],
            [2025, 400],
        ])
        assert.deepEqual([...approx.get(2)!.entries()], [[2024, 120]])
    })

    it('completados, nota media, histograma, logros por mes, 100 % y géneros del año', () => {
        const input: StatsInput = {
            games: [
                game({ appid: 1, status: 'completado', completed_at: '2025-02-10T10:00:00Z', rating: 8, genres: [{ description: 'Acción' }] }),
                game({ appid: 2, status: 'completado', completed_at: '2025-06-10T10:00:00Z', rating: 7.5, genres: [{ description: 'Acción' }, { description: 'Indie' }] }),
                game({ appid: 3, status: 'completado', completed_at: '2024-06-10T10:00:00Z', rating: 3 }),
                game({ appid: 4, achievements_total: 2, achievements_unlocked: 2, last_unlock_at: '2025-07-01T10:00:00Z', playtime_forever: 90 }),
            ],
            unlocks: [unlock(4, '2025-07-01T10:00:00Z', 1.5), unlock(4, '2025-01-05T10:00:00Z', 30)],
            daily: [],
            historyStart: null,
        }
        const s = yearStats(input, 2025)
        assert.deepEqual(s.completed.map((g) => g.appid), [1, 2])
        assert.equal(s.averageRating, 7.8)
        assert.equal(s.ratingHistogram[8], 2)
        assert.equal(s.unlocks, 2)
        assert.equal(s.unlocksByMonth[0], 1)
        assert.equal(s.unlocksByMonth[6], 1)
        assert.deepEqual(s.perfect.map((g) => g.appid), [4])
        assert.deepEqual(s.genres[0], { name: 'Acción', count: 2 })
        assert.equal(s.rarest?.global_percent, 1.5)
        assert.equal(s.hoursMeasured, false)
        assert.equal(s.minutes, 90)
        assert.deepEqual(s.topGames.map((g) => g.appid), [4])
    })

    it('horas medidas si el historial cubre el año entero; si no, aproximadas', () => {
        const input: StatsInput = {
            games: [game({ appid: 1, playtime_forever: 1000, rtime_last_played: '2027-03-01T10:00:00Z' })],
            unlocks: [],
            daily: [
                { appid: 1, date: '2026-10-25', minutes: 60 },
                { appid: 1, date: '2027-02-01', minutes: 30 },
                { appid: 1, date: '2027-02-02', minutes: 45 },
            ],
            historyStart: '2026-10-24',
        }
        const y2026 = yearStats(input, 2026)
        assert.equal(y2026.hoursMeasured, false)
        assert.equal(y2026.measuredMinutes, 60)
        const y2027 = yearStats(input, 2027)
        assert.equal(y2027.hoursMeasured, true)
        assert.equal(y2027.minutes, 75)
        assert.equal(y2027.bestStreak.length, 2)
    })

    it('años disponibles hasta el actual y diferencias', () => {
        const input: StatsInput = {
            games: [game({ completed_at: '2019-01-01T10:00:00Z' })],
            unlocks: [unlock(1, '2013-05-01T10:00:00Z')],
            daily: [],
            historyStart: null,
        }
        assert.deepEqual(availableYears(input, new Date('2026-10-25T10:00:00Z')), [2026, 2019, 2013])
        assert.equal(delta(5, 3), 2)
        assert.equal(delta(null, 3), null)
    })
})

describe('resumen anual (#33)', () => {
    it('top 5 por horas, logro más raro con su juego, racha y totales', () => {
        const input: StatsInput = {
            games: [
                game({ appid: 1, name: 'Hades', playtime_forever: 600, genres: [{ description: 'Acción' }] }),
                game({ appid: 2, name: 'Celeste', playtime_forever: 300 }),
            ],
            unlocks: [unlock(1, '2025-03-01T10:00:00Z', 0.8), unlock(1, '2025-03-02T10:00:00Z', 40), unlock(2, '2025-03-03T10:00:00Z', 12)],
            daily: [],
            historyStart: null,
        }
        const w = buildWrapped(yearStats(input, 2025), input.games)
        assert.deepEqual(w.top.map((g) => g.name), ['Hades', 'Celeste'])
        assert.equal(w.rarest?.game, 'Hades')
        assert.equal(w.rarest?.global_percent, 0.8)
        assert.equal(w.streak.length, 3)
        assert.equal(w.minutes, 900)
        assert.equal(w.topGenre, 'Acción')
        assert.equal(hasWrapped(w), true)
        assert.equal(hasWrapped(buildWrapped(yearStats(input, 2010), input.games)), false)
    })
})

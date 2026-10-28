import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    achievementPoints,
    computeMilestones,
    countByGame,
    estimateDifficulty,
    seriesProgress,
    thisMonth,
    unlockedByRarity,
    pointsByGame,
    pointsOf,
    forgottenGames,
    lastTouched,
    nearCompletion,
    perfectGames,
    rarestUnlocked,
    formatPercent,
    matchesAchievementFilter,
    sortAchievements,
    youtubeSearchUrl,
    type Achievement,
} from './achievements'

let nextId = 1

function ach(overrides: Partial<Achievement> = {}): Achievement {
    return {
        appid: 10,
        apiname: `A${nextId++}`,
        achieved: false,
        unlocktime: null,
        display_name: 'Logro',
        description: null,
        icon: null,
        icongray: null,
        hidden: false,
        global_percent: 50,
        ...overrides,
    }
}

describe('formatPercent', () => {
    it('usa coma decimal por debajo del 10 %', () => {
        assert.equal(formatPercent(4.25), '4,3 %')
        assert.equal(formatPercent(42.6), '43 %')
        assert.equal(formatPercent(null), '—')
    })
})

describe('matchesAchievementFilter', () => {
    it('filtra bloqueados, desbloqueados y ocultos', () => {
        const locked = ach()
        const unlocked = ach({ achieved: true })
        const hidden = ach({ hidden: true })
        assert.ok(matchesAchievementFilter(locked, 'bloqueados'))
        assert.ok(!matchesAchievementFilter(unlocked, 'bloqueados'))
        assert.ok(matchesAchievementFilter(unlocked, 'desbloqueados'))
        assert.ok(matchesAchievementFilter(hidden, 'ocultos'))
        assert.ok(!matchesAchievementFilter(locked, 'ocultos'))
        assert.ok(matchesAchievementFilter(hidden, 'todos'))
    })
})

describe('sortAchievements', () => {
    it('rareza: más raros primero y sin dato al final', () => {
        const a = ach({ display_name: 'A', global_percent: 30 })
        const b = ach({ display_name: 'B', global_percent: 2 })
        const c = ach({ display_name: 'C', global_percent: null })
        assert.deepEqual(sortAchievements([a, c, b], 'rareza').map((x) => x.display_name), ['B', 'A', 'C'])
    })

    it('fecha: recientes primero y bloqueados al final por nombre', () => {
        const old = ach({ display_name: 'Viejo', achieved: true, unlocktime: '2025-01-01T00:00:00Z' })
        const recent = ach({ display_name: 'Nuevo', achieved: true, unlocktime: '2026-01-01T00:00:00Z' })
        const lockedB = ach({ display_name: 'b' })
        const lockedA = ach({ display_name: 'a' })
        assert.deepEqual(
            sortAchievements([lockedB, old, lockedA, recent], 'fecha').map((x) => x.display_name),
            ['Nuevo', 'Viejo', 'a', 'b'],
        )
    })

    it('nombre: orden alfabético en español', () => {
        const list = [ach({ display_name: 'Ñandú' }), ach({ display_name: 'Nube' }), ach({ display_name: 'Árbol' })]
        assert.deepEqual(sortAchievements(list, 'nombre').map((x) => x.display_name), ['Árbol', 'Nube', 'Ñandú'])
    })
})

describe('estimateDifficulty', () => {
    it('null si no falta ninguno', () => {
        assert.equal(estimateDifficulty([ach({ achieved: true })]), null)
    })

    it('el logro más raro que falta marca el nivel', () => {
        const est = estimateDifficulty([ach({ global_percent: 70 }), ach({ global_percent: 3 }), ach({ achieved: true, global_percent: 0.1 })])
        assert.deepEqual(est, { level: 'dificil', remaining: 2, rarest: 3, hard: 1 })
    })

    it('la rareza del más raro que falta marca el nivel (escala de rarity.ts)', () => {
        assert.equal(estimateDifficulty([ach({ global_percent: 30 })])?.level, 'asequible')
        assert.equal(estimateDifficulty([ach({ global_percent: 10 })])?.level, 'exigente')
        assert.equal(estimateDifficulty([ach({ global_percent: 0.5 })])?.level, 'muy_dificil')
    })

    it('solo comunes: fácil', () => {
        assert.equal(estimateDifficulty([ach({ global_percent: 90 })])?.level, 'facil')
    })

    it('muchos raros suben un escalón', () => {
        const list = Array.from({ length: 10 }, () => ach({ global_percent: 10 }))
        assert.equal(estimateDifficulty(list)?.level, 'dificil')
    })

    it('sin % global: asequible por defecto', () => {
        assert.equal(estimateDifficulty([ach({ global_percent: null })])?.level, 'asequible')
    })
})

describe('youtubeSearchUrl', () => {
    it('codifica el juego y el logro', () => {
        assert.equal(youtubeSearchUrl('Hades', 'Fin & principio'), 'https://www.youtube.com/results?search_query=Hades%20Fin%20%26%20principio%20logro')
    })
})

type Game = Parameters<typeof nearCompletion>[0][number]

function game(appid: number, unlocked: number | null, total: number | null, extra: Partial<Game> = {}): Game {
    return { appid, achievements_unlocked: unlocked, achievements_total: total, rtime_last_played: null, last_unlock_at: null, ...extra }
}

const NOW = Date.parse('2026-10-25T12:00:00Z')
const daysAgo = (d: number) => new Date(NOW - d * 24 * 3600_000).toISOString()

describe('nearCompletion', () => {
    it('desde el 50 %, sin el 100 %, por logros restantes', () => {
        const list = [game(1, 9, 10), game(2, 45, 50), game(3, 10, 10), game(4, 4, 10), game(5, 5, 10), game(6, 0, 0), game(7, 98, 100)]
        assert.deepEqual(nearCompletion(list).map((g) => g.appid), [1, 7, 2, 5])
    })

    it('a igualdad de restantes, el más avanzado primero', () => {
        assert.deepEqual(nearCompletion([game(1, 8, 10), game(2, 18, 20)]).map((g) => g.appid), [2, 1])
    })
})

describe('lastTouched', () => {
    it('la fecha más reciente entre partida y desbloqueo', () => {
        assert.equal(lastTouched({ rtime_last_played: daysAgo(10), last_unlock_at: daysAgo(5) }), NOW - 5 * 24 * 3600_000)
        assert.equal(lastTouched({ rtime_last_played: null, last_unlock_at: null }), null)
    })
})

describe('forgottenGames', () => {
    it('más del 50 %, sin el 100 % y más de 90 días sin tocar', () => {
        const list = [
            game(1, 6, 10, { rtime_last_played: daysAgo(100), last_unlock_at: daysAgo(120) }),
            game(2, 9, 10, { rtime_last_played: daysAgo(200) }),
            game(3, 6, 10, { rtime_last_played: daysAgo(100), last_unlock_at: daysAgo(30) }),
            game(4, 5, 10, { rtime_last_played: daysAgo(300) }),
            game(5, 10, 10, { rtime_last_played: daysAgo(300) }),
            game(6, 8, 10),
        ]
        assert.deepEqual(forgottenGames(list, NOW).map((g) => g.appid), [2, 1])
    })
})

describe('perfectGames', () => {
    it('solo los 100 %, el más reciente primero', () => {
        const list = [game(1, 10, 10, { last_unlock_at: daysAgo(50) }), game(2, 3, 3, { last_unlock_at: daysAgo(1) }), game(3, 2, 3), game(4, 0, 0)]
        assert.deepEqual(perfectGames(list).map((g) => g.appid), [2, 1])
    })
})

describe('rarestUnlocked', () => {
    it('desbloqueados con % global, de más raro a más común', () => {
        const list = [
            ach({ apiname: 'a', achieved: true, global_percent: 12 }),
            ach({ apiname: 'b', achieved: true, global_percent: 0.5 }),
            ach({ apiname: 'c', achieved: false, global_percent: 0.1 }),
            ach({ apiname: 'd', achieved: true, global_percent: null }),
            ach({ apiname: 'e', achieved: true, global_percent: 3 }),
        ]
        assert.deepEqual(rarestUnlocked(list, 2).map((a) => a.apiname), ['b', 'e'])
    })
})

describe('achievementPoints', () => {
    it('escala logarítmica con mínimo 1', () => {
        assert.equal(achievementPoints(100), 1)
        assert.equal(achievementPoints(50), 3)
        assert.equal(achievementPoints(10), 10)
        assert.equal(achievementPoints(1), 20)
        assert.equal(achievementPoints(0.1), 30)
        assert.equal(achievementPoints(0.01), 30)
        assert.equal(achievementPoints(null), 1)
    })
})

describe('pointsOf y pointsByGame', () => {
    it('suma ganados y posibles', () => {
        assert.deepEqual(pointsOf([ach({ achieved: true, global_percent: 10 }), ach({ global_percent: 1 })]), { earned: 10, possible: 30 })
    })

    it('total y por juego, de más a menos', () => {
        const list = [
            ach({ appid: 1, achieved: true, global_percent: 50 }),
            ach({ appid: 2, achieved: true, global_percent: 1 }),
            ach({ appid: 1, achieved: true, global_percent: 10 }),
            ach({ appid: 3, achieved: false, global_percent: 1 }),
        ]
        assert.deepEqual(pointsByGame(list), { total: 33, games: [{ appid: 2, points: 20 }, { appid: 1, points: 13 }] })
    })
})

describe('computeMilestones', () => {
    const day = (n: number) => new Date(Date.UTC(2025, 0, 1) + n * 24 * 3600_000).toISOString()

    it('fecha de cada hito con los desbloqueos y el siguiente de cada serie', () => {
        // 120 logros: el 100.º el día 99. El juego 1 (3 logros) se completa el día 2; el 2 no está completo.
        const unlocked = Array.from({ length: 120 }, (_, i) =>
            ach({ appid: i < 3 ? 1 : 2, achieved: true, unlocktime: day(i), global_percent: i === 50 ? 3 : i === 80 ? 0.5 : 40 }),
        )
        const games = [
            { appid: 1, achievements_total: 3, achievements_unlocked: 3 },
            { appid: 2, achievements_total: 200, achievements_unlocked: 117 },
        ]
        const { reached, next } = computeMilestones([...unlocked].reverse(), games)
        assert.deepEqual(
            reached.map((m) => [m.id, m.date]),
            [
                ['logros-100', day(99)],
                ['primer-legendario', day(80)],
                ['primer-epico', day(50)],
                ['perfectos-1', day(2)],
            ],
        )
        assert.deepEqual(
            next.map((m) => [m.id, m.current, m.target]),
            [
                ['logros-500', 120, 500],
                ['perfectos-10', 1, 10],
            ],
        )
    })

    it('sin logros: todo pendiente', () => {
        const { reached, next } = computeMilestones([], [])
        assert.equal(reached.length, 0)
        assert.deepEqual(next.map((m) => m.id), ['logros-100', 'perfectos-1', 'primer-epico', 'primer-legendario'])
    })
})

describe('computeMilestones: series completas', () => {
    const day = (n: number) => new Date(Date.UTC(2025, 0, 1) + n * 24 * 3600_000).toISOString()

    it('todos los escalones, alcanzados con fecha y futuros sin ella', () => {
        const unlocked = Array.from({ length: 120 }, (_, i) =>
            ach({ appid: i < 3 ? 1 : 2, achieved: true, unlocktime: day(i), global_percent: i === 50 ? 3 : 40 }),
        )
        const games = [
            { appid: 1, achievements_total: 3, achievements_unlocked: 3 },
            { appid: 2, achievements_total: 200, achievements_unlocked: 117 },
        ]
        const { series } = computeMilestones(unlocked, games)
        assert.equal(series.count.current, 120)
        assert.deepEqual(
            series.count.steps.map((s) => [s.value, s.reached, s.date]),
            [
                [100, true, day(99)],
                [500, false, null],
                [1000, false, null],
                [2500, false, null],
                [5000, false, null],
                [10000, false, null],
            ],
        )
        assert.equal(series.count.steps[5].label, '10.000 logros')
        assert.equal(series.perfect.current, 1)
        assert.deepEqual(
            series.perfect.steps.map((s) => [s.value, s.reached]),
            [
                [1, true],
                [10, false],
                [25, false],
                [50, false],
                [100, false],
            ],
        )
        assert.equal(series.perfect.steps[0].date, day(2))
        assert.deepEqual(
            series.rare.map((r) => [r.id, r.tier, r.reached, r.date]),
            [
                ['primer-epico', 'epica', true, day(50)],
                ['primer-legendario', 'leg', false, null],
            ],
        )
    })

    it('sin logros: series enteras sin alcanzar', () => {
        const { series } = computeMilestones([], [])
        assert.equal(series.count.current, 0)
        assert.ok(series.count.steps.every((s) => !s.reached))
        assert.equal(series.perfect.steps.length, 5)
        assert.ok(series.rare.every((r) => !r.reached))
    })
})

describe('seriesProgress', () => {
    const steps = [100, 500, 1000, 2500, 5000, 10000]
    it('0 antes del primer escalón y 1 al pasar el último', () => {
        assert.equal(seriesProgress(0, steps), 0)
        assert.equal(seriesProgress(99, steps), 0)
        assert.equal(seriesProgress(10000, steps), 1)
        assert.equal(seriesProgress(20000, steps), 1)
    })
    it('en un escalón, su posición; entre dos, la parte proporcional', () => {
        assert.equal(seriesProgress(100, steps), 0)
        assert.equal(seriesProgress(500, steps), 0.2)
        assert.equal(seriesProgress(300, steps), 0.1)
        assert.equal(seriesProgress(1750, steps), 0.5)
    })
    it('un solo escalón: todo o nada', () => {
        assert.equal(seriesProgress(0, [1]), 0)
        assert.equal(seriesProgress(1, [1]), 1)
    })
})

describe('unlockedByRarity', () => {
    it('cuenta y suma puntos por rareza, con todas las rarezas aunque estén vacías', () => {
        const list = [
            ach({ achieved: true, global_percent: 50 }),
            ach({ achieved: true, global_percent: 60 }),
            ach({ achieved: true, global_percent: 0.5 }),
            ach({ achieved: true, global_percent: null }),
            ach({ achieved: false, global_percent: 2 }),
        ]
        assert.deepEqual(unlockedByRarity(list), [
            { tier: 'comun', count: 2, points: 5 },
            { tier: 'poco', count: 0, points: 0 },
            { tier: 'rara', count: 0, points: 0 },
            { tier: 'epica', count: 0, points: 0 },
            { tier: 'leg', count: 1, points: 23 },
        ])
    })
})

describe('thisMonth', () => {
    it('solo los desbloqueados desde el día 1 del mes', () => {
        const now = new Date(2026, 9, 28, 12)
        const list = [
            ach({ achieved: true, unlocktime: new Date(2026, 9, 1, 0, 5).toISOString(), global_percent: 10 }),
            ach({ achieved: true, unlocktime: new Date(2026, 9, 20).toISOString(), global_percent: 50 }),
            ach({ achieved: true, unlocktime: new Date(2026, 8, 30, 23).toISOString(), global_percent: 1 }),
            ach({ achieved: true, unlocktime: null, global_percent: 1 }),
        ]
        assert.deepEqual(thisMonth(list, now), { achievements: 2, points: 13 })
    })
})

describe('countByGame', () => {
    it('cuenta por appid', () => {
        const counts = countByGame([ach({ appid: 1 }), ach({ appid: 2 }), ach({ appid: 1 })])
        assert.equal(counts.get(1), 2)
        assert.equal(counts.get(2), 1)
        assert.equal(counts.get(3), undefined)
    })
})

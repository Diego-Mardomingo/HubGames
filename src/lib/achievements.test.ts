import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    estimateDifficulty,
    forgottenGames,
    lastTouched,
    nearCompletion,
    perfectGames,
    rarestUnlocked,
    formatPercent,
    matchesAchievementFilter,
    rarity,
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

describe('rarity', () => {
    it('clasifica por tramos', () => {
        assert.equal(rarity(80), 'comun')
        assert.equal(rarity(50), 'poco_comun')
        assert.equal(rarity(20), 'poco_comun')
        assert.equal(rarity(19.9), 'raro')
        assert.equal(rarity(5), 'raro')
        assert.equal(rarity(1), 'muy_raro')
        assert.equal(rarity(0.4), 'ultra_raro')
        assert.equal(rarity(null), null)
    })
})

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

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    estimateDifficulty,
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

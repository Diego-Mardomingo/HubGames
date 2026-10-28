import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Achievement } from './achievements'
import { DIFFICULTY_TIERS, filterAchievements, lastUnlock, matchesRarity, rarityColumns, stateCounts } from './game-achievements'

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

// Un juego pequeño: dos comunes (uno conseguido), una épica oculta bloqueada, una legendaria conseguida y una sin dato.
const comunOk = ach({ display_name: 'Bravo', achieved: true, unlocktime: '2024-01-02T10:00:00Z', global_percent: 60 })
const comunNo = ach({ display_name: 'Alfa', global_percent: 45 })
const epicaOculta = ach({ display_name: 'Charlie', hidden: true, global_percent: 3 })
const legOk = ach({ display_name: 'Delta', achieved: true, unlocktime: '2024-03-05T10:00:00Z', global_percent: 0.5 })
const sinDato = ach({ display_name: 'Eco', achieved: true, unlocktime: '2023-12-31T10:00:00Z', global_percent: null })
const GAME = [comunOk, comunNo, epicaOculta, legOk, sinDato]

describe('matchesRarity', () => {
    it('sin rareza deja pasar todo, también lo que no tiene dato', () => {
        assert.ok(matchesRarity(sinDato, null))
        assert.ok(matchesRarity(legOk, null))
    })
    it('con rareza, solo los de esa rareza y nunca los que no tienen dato', () => {
        assert.ok(matchesRarity(legOk, 'leg'))
        assert.ok(!matchesRarity(comunOk, 'leg'))
        assert.ok(!matchesRarity(sinDato, 'comun'))
    })
})

describe('stateCounts', () => {
    it('sin rareza cuenta cada estado sobre todo el juego', () => {
        assert.deepEqual(stateCounts(GAME, null), { todos: 5, bloqueados: 2, desbloqueados: 3, ocultos: 1 })
    })
    it('con rareza, cada estado cuenta solo dentro de esa rareza', () => {
        assert.deepEqual(stateCounts(GAME, 'comun'), { todos: 2, bloqueados: 1, desbloqueados: 1, ocultos: 0 })
        assert.deepEqual(stateCounts(GAME, 'epica'), { todos: 1, bloqueados: 1, desbloqueados: 0, ocultos: 1 })
    })
    it('una rareza sin logros da todo a cero', () => {
        assert.deepEqual(stateCounts(GAME, 'rara'), { todos: 0, bloqueados: 0, desbloqueados: 0, ocultos: 0 })
    })
})

describe('filterAchievements', () => {
    const names = (list: Achievement[]) => list.map((a) => a.display_name)
    it('combina estado y rareza', () => {
        assert.deepEqual(names(filterAchievements(GAME, 'desbloqueados', 'comun', 'nombre')), ['Bravo'])
        assert.deepEqual(names(filterAchievements(GAME, 'bloqueados', null, 'nombre')), ['Alfa', 'Charlie'])
    })
    it('ordena por rareza (sin dato al final), recientes o nombre', () => {
        assert.deepEqual(names(filterAchievements(GAME, 'todos', null, 'rareza')), ['Delta', 'Charlie', 'Alfa', 'Bravo', 'Eco'])
        assert.deepEqual(names(filterAchievements(GAME, 'todos', null, 'fecha')), ['Delta', 'Bravo', 'Eco', 'Alfa', 'Charlie'])
        assert.deepEqual(names(filterAchievements(GAME, 'todos', null, 'nombre')), ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Eco'])
    })
    it('una combinación sin resultados da una lista vacía', () => {
        assert.deepEqual(filterAchievements(GAME, 'ocultos', 'leg', 'rareza'), [])
    })
    it('no modifica la lista original', () => {
        const copy = [...GAME]
        filterAchievements(GAME, 'todos', null, 'nombre')
        assert.deepEqual(GAME, copy)
    })
})

describe('rarityColumns', () => {
    it('solo las rarezas que tiene el juego, de común a legendaria, sin los que no tienen dato', () => {
        const cols = rarityColumns(GAME)
        assert.deepEqual(
            cols.map((c) => [c.tier, c.unlocked, c.total]),
            [
                ['comun', 1, 2],
                ['epica', 0, 1],
                ['leg', 1, 1],
            ],
        )
    })
    it('suma los puntos conseguidos y los posibles de cada rareza', () => {
        const [comun, epica, leg] = rarityColumns(GAME)
        // 60 % → 2 puntos, 45 % → 3, 3 % → 15, 0,5 % → 30 (achievementPoints, máximo 30).
        assert.equal(comun.earned, 2)
        assert.equal(comun.possible, 5)
        assert.equal(epica.earned, 0)
        assert.equal(epica.possible, 15)
        assert.equal(leg.earned, leg.possible)
    })
    it('sin logros, sin columnas', () => {
        assert.deepEqual(rarityColumns([]), [])
    })
})

describe('lastUnlock', () => {
    it('la fecha del último desbloqueado', () => {
        assert.equal(lastUnlock(GAME), '2024-03-05T10:00:00Z')
    })
    it('null si no hay ninguno desbloqueado con fecha', () => {
        assert.equal(lastUnlock([comunNo, ach({ achieved: true, unlocktime: null })]), null)
    })
})

describe('DIFFICULTY_TIERS', () => {
    it('reutiliza la escala de rarezas', () => {
        assert.equal(DIFFICULTY_TIERS.facil, 'comun')
        assert.equal(DIFFICULTY_TIERS.muy_dificil, 'leg')
    })
})

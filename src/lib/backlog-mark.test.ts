// #140: añadir a Pendientes sin perder el estado (marca in_backlog).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { canMarkBacklog, inBacklog, inTab, sortGames } from './library'
import { listCounts, nextInQueue } from './dashboard'
import { recommend } from './recommend'
import { evaluateGame, type RuleInput } from './tracker-rules'
import { pendingAction } from './game-search'
import { statusPatch } from './library-motion'
import { libraryRows } from './export'
import type { GameStatus } from './tracker'
import { libraryGame as game } from './test-utils'

const names = (list: { name: string | null }[]) => list.map((g) => g.name)

describe('Pendientes con su estado: dónde se ofrece', () => {
    it('en todos los estados menos Pendiente, Jugando y Descartado', () => {
        // tracker.ts crea el cliente de Supabase al importarse: la lista, copiada aquí.
        const all: GameStatus[] = ['bandeja', 'pendiente', 'jugando', 'pausado', 'rejugable', 'completado', 'abandonado', 'ya_jugado', 'descartado', 'otros']
        const allowed = all.filter(canMarkBacklog)
        assert.deepEqual(allowed, ['bandeja', 'pausado', 'rejugable', 'completado', 'abandonado', 'ya_jugado', 'otros'])
    })

    it('está en Pendientes con la marca o en estado Pendiente; la marca no cuenta en Jugando ni Descartado', () => {
        assert.equal(inBacklog(game({ status: 'pendiente' })), true)
        assert.equal(inBacklog(game({ status: 'completado', in_backlog: true })), true)
        assert.equal(inBacklog(game({ status: 'completado' })), false)
        assert.equal(inBacklog(game({ status: 'jugando', in_backlog: true })), false)
        assert.equal(inBacklog(game({ status: 'descartado', in_backlog: true })), false)
    })
})

describe('Pendientes con su estado: biblioteca', () => {
    it('sale en Pendientes y en la lista de su estado', () => {
        const hades = game({ status: 'completado', in_backlog: true })
        assert.equal(inTab(hades, 'pendiente'), true)
        assert.equal(inTab(hades, 'completado'), true)
        assert.equal(inTab(hades, 'todos'), true)
    })

    it('mismo orden manual que el resto; los recién añadidos, al final por orden de llegada', () => {
        const list = [
            game({ name: 'Añadido hoy', status: 'ya_jugado', in_backlog: true, in_backlog_at: '2026-11-20T00:00:00Z', status_changed_at: '2026-01-01T00:00:00Z' }),
            game({ name: 'Segundo', backlog_position: 2 }),
            game({ name: 'Primero', status: 'completado', in_backlog: true, backlog_position: 1 }),
            game({ name: 'Pendiente nuevo', backlog_position: null, status_changed_at: '2026-11-10T00:00:00Z' }),
        ]
        assert.deepEqual(names(sortGames(list, 'manual')), ['Primero', 'Segundo', 'Pendiente nuevo', 'Añadido hoy'])
    })

    it('pasar a Jugando, Pendiente o Descartado desde el menú quita la marca; a otro estado, no', () => {
        const now = '2026-11-23T10:00:00.000Z'
        const g = game({ status: 'completado', in_backlog: true })
        assert.equal(statusPatch(g, 'jugando', now).in_backlog, false)
        assert.equal(statusPatch(g, 'pendiente', now).in_backlog, false)
        assert.equal(statusPatch(g, 'descartado', now).in_backlog, false)
        assert.equal(statusPatch(g, 'abandonado', now).in_backlog, undefined)
        assert.equal(statusPatch(game({ status: 'completado' }), 'jugando', now).in_backlog, undefined)
    })

    it('la exportación dice si está en Pendientes', () => {
        const [row] = libraryRows([game({ status: 'completado', in_backlog: true })])
        assert.equal(row.en_pendientes, true)
        assert.equal(row.estado, 'completado')
    })
})

describe('Pendientes con su estado: Inicio', () => {
    it('la cola incluye los añadidos con su estado, en tu orden', () => {
        const list = [
            game({ name: 'P2', backlog_position: 2 }),
            game({ name: 'Rejugar', status: 'completado', in_backlog: true, backlog_position: 1 }),
            game({ name: 'Completado', status: 'completado', backlog_position: 0 }),
        ]
        assert.deepEqual(names(nextInQueue(list)), ['Rejugar', 'P2'])
    })

    it('el atajo de Pendientes los cuenta, y siguen contando en su estado', () => {
        const games = [game({ status: 'pendiente' }), game({ status: 'completado', in_backlog: true }), game({ status: 'completado' })]
        const unowned = [game({ status: 'pendiente', owned: false }), game({ status: 'ya_jugado', in_backlog: true, owned: false })]
        const counts = listCounts(games, unowned)
        assert.equal(counts.pendiente, 4)
        assert.equal(counts.completado, 2)
        assert.equal(counts.ya_jugado, 0)
    })
})

describe('Pendientes con su estado: ¿Qué juego hoy?', () => {
    const NOW = Date.parse('2026-11-23T12:00:00Z')

    it('«Empezar algo nuevo» propone los añadidos aunque ya los jugaras, en tu orden', () => {
        const list = [
            game({ name: 'Rejugar', status: 'completado', in_backlog: true, backlog_position: 1, playtime_forever: 3000 }),
            game({ name: 'Nuevo', backlog_position: 2 }),
            game({ name: 'Completado', status: 'completado', playtime_forever: 3000 }),
        ]
        assert.deepEqual(names(recommend(list, 'media', 'nuevo', NOW).map((r) => r.game)), ['Rejugar', 'Nuevo'])
    })

    it('«Terminar algo» no propone cerrar lo que ya terminaste y has vuelto a poner en la cola', () => {
        const list = [game({ name: 'Rejugar', status: 'completado', in_backlog: true, playtime_forever: 3000, hltb_main: 600 })]
        assert.deepEqual(recommend(list, 'media', 'terminar', NOW), [])
    })
})

describe('Pendientes con su estado: sincronización', () => {
    const NOW = Date.parse('2026-11-23T12:00:00Z')
    const daysAgo = (n: number) => new Date(NOW - n * 24 * 3600_000).toISOString()
    const rule = (overrides: Partial<RuleInput>): RuleInput => ({
        status: 'completado',
        status_source: 'manual',
        status_changed_at: daysAgo(200),
        rtime_last_played: null,
        playtime_forever: 3000,
        playtime_2weeks: 0,
        achievements_total: null,
        achievements_unlocked: null,
        last_unlock_at: null,
        suggestion_dismissed_at: null,
        ...overrides,
    })

    it('pasa a Jugando si lo juegas después de añadirlo, como cualquier pendiente', () => {
        const out = evaluateGame(rule({ in_backlog: true, in_backlog_at: daysAgo(5), rtime_last_played: daysAgo(1) }), NOW)
        assert.equal(out.status, 'jugando')
        assert.equal(out.statusChanged, true)
    })

    it('una partida anterior a añadirlo no lo mueve', () => {
        const out = evaluateGame(rule({ in_backlog: true, in_backlog_at: daysAgo(1), rtime_last_played: daysAgo(3), playtime_2weeks: 60 }), NOW)
        assert.equal(out.status, 'completado')
        assert.equal(out.statusChanged, false)
    })

    it('sin la marca, un completado que vuelves a jugar sigue completado', () => {
        const out = evaluateGame(rule({ rtime_last_played: daysAgo(1), playtime_2weeks: 60 }), NOW)
        assert.equal(out.status, 'completado')
    })
})

describe('Pendientes con su estado: buscador y JUDI', () => {
    it('«Pendientes» ya hecho si está añadido con su estado', () => {
        assert.equal(pendingAction('completado', true), 'done')
        assert.equal(pendingAction('completado', false), 'move')
        assert.equal(pendingAction('jugando'), 'move')
    })
})

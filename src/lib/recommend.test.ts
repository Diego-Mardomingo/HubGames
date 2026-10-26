import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { recommend } from './recommend'
import { libraryGame as game } from './test-utils'

const NOW = Date.parse('2026-10-25T12:00:00Z')
const daysAgo = (d: number) => new Date(NOW - d * 24 * 3600_000).toISOString()
const names = (list: ReturnType<typeof recommend>) => list.map((r) => r.game.name)

describe('¿Qué juego hoy?', () => {
    it('solo Jugando y Pendientes', () => {
        const list = [
            game({ name: 'Jugando', status: 'jugando', playtime_forever: 300 }),
            game({ name: 'Completado', status: 'completado', playtime_forever: 300 }),
            game({ name: 'Pausado', status: 'pausado', playtime_forever: 300 }),
        ]
        assert.deepEqual(names(recommend(list, 'media', 'terminar', NOW)), ['Jugando'])
    })

    it('terminar: primero lo que menos falta, y avisa si da tiempo hoy', () => {
        const list = [
            game({ name: 'Largo', status: 'jugando', playtime_forever: 120, hltb_main: 40 * 60 }),
            game({ name: 'Casi', status: 'jugando', playtime_forever: 500, hltb_main: 600 }),
            game({ name: 'Sin empezar', status: 'pendiente', hltb_main: 120 }),
        ]
        const out = recommend(list, 'media', 'terminar', NOW)
        assert.deepEqual(names(out), ['Casi', 'Largo'])
        assert.match(out[0].reasons.join(' | '), /Te faltan unas 1,7 h/)
        assert.ok(out[0].reasons.includes('Te da tiempo a acabarlo hoy'))
    })

    it('sin final: no sale en terminar ni cuenta su duración', () => {
        const cs = game({ name: 'CS', status: 'jugando', endless: true, playtime_forever: 5000, hltb_main: 120 })
        const casi = game({ name: 'Casi', status: 'jugando', playtime_forever: 500, hltb_main: 600 })
        assert.deepEqual(names(recommend([cs, casi], 'media', 'terminar', NOW)), ['Casi'])
        const corto = recommend([game({ name: 'Roguelike', endless: true, hltb_main: 120 })], 'corta', 'sorpresa', NOW)
        assert.ok(!corto[0].reasons.some((r) => r.startsWith('Es corto')))
    })

    it('nuevo: pendientes sin empezar, en el orden de tu cola', () => {
        const list = [
            game({ name: 'Tercero', backlog_position: 3 }),
            game({ name: 'Primero', backlog_position: 1 }),
            game({ name: 'Empezado', backlog_position: 0, playtime_forever: 200 }),
            game({ name: 'Jugando', status: 'jugando', backlog_position: 0 }),
        ]
        const out = recommend(list, 'larga', 'nuevo', NOW)
        assert.deepEqual(names(out), ['Primero', 'Tercero'])
        assert.equal(out[0].reasons[0], 'Es de los primeros de tu cola (#1)')
    })

    it('sesión corta: un juego corto sin empezar sube; uno muy largo baja', () => {
        const list = [
            game({ name: 'Eterno', backlog_position: 1, hltb_main: 60 * 60 }),
            game({ name: 'Corto', backlog_position: 2, hltb_main: 3 * 60 }),
        ]
        assert.deepEqual(names(recommend(list, 'corta', 'nuevo', NOW)), ['Corto', 'Eterno'])
        assert.deepEqual(names(recommend(list, 'larga', 'nuevo', NOW)), ['Eterno', 'Corto'])
    })

    it('logros: solo con logros pendientes, el más avanzado primero', () => {
        const list = [
            game({ name: 'Medio', status: 'jugando', achievements_total: 10, achievements_unlocked: 5 }),
            game({ name: 'Perfecto', status: 'jugando', achievements_total: 10, achievements_unlocked: 10 }),
            game({ name: 'Avanzado', status: 'jugando', achievements_total: 10, achievements_unlocked: 9 }),
            game({ name: 'Sin logros', status: 'jugando' }),
        ]
        const out = recommend(list, 'media', 'logros', NOW)
        assert.deepEqual(names(out), ['Avanzado', 'Medio'])
        assert.equal(out[0].reasons[0], 'Llevas el 90 % de los logros (te faltan 1)')
    })

    it('lo jugado hace poco tiene inercia', () => {
        const list = [
            game({ name: 'Olvidado', status: 'jugando', playtime_forever: 300, hltb_main: 900, rtime_last_played: daysAgo(200) }),
            game({ name: 'Ayer', status: 'jugando', playtime_forever: 300, hltb_main: 900, rtime_last_played: daysAgo(1) }),
        ]
        const out = recommend(list, 'media', 'terminar', NOW)
        assert.deepEqual(names(out), ['Ayer', 'Olvidado'])
        assert.ok(out[0].reasons.includes('Lo jugaste ayer'))
    })

    it('sorpréndeme: depende de la semilla y es reproducible', () => {
        const list = Array.from({ length: 12 }, (_, i) => game({ name: `J${i}`, status: 'jugando', playtime_forever: 100 }))
        const a = names(recommend(list, 'media', 'sorpresa', NOW, 1))
        assert.deepEqual(names(recommend(list, 'media', 'sorpresa', NOW, 1)), a)
        assert.notDeepEqual(names(recommend(list, 'media', 'sorpresa', NOW, 2)), a)
    })
})

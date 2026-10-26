import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateGame, isPerfect, type RuleInput } from './tracker-rules'

const NOW = Date.parse('2026-10-24T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW - n * 24 * 3600_000).toISOString()

function game(overrides: Partial<RuleInput> = {}): RuleInput {
    return {
        status: 'bandeja',
        status_source: 'auto',
        status_changed_at: daysAgo(100),
        rtime_last_played: null,
        playtime_forever: 0,
        playtime_2weeks: 0,
        achievements_total: null,
        achievements_unlocked: null,
        last_unlock_at: null,
        suggestion_dismissed_at: null,
        ...overrides,
    }
}

describe('Jugando según actividad', () => {
    for (const status of ['bandeja', 'pendiente', 'pausado'] as const) {
        it(`${status} jugado hace 3 días pasa a jugando`, () => {
            const out = evaluateGame(game({ status, rtime_last_played: daysAgo(3) }), NOW)
            assert.equal(out.status, 'jugando')
            assert.equal(out.statusChanged, true)
        })
    }

    it('cuenta playtime_2weeks aunque falte la fecha de última partida', () => {
        assert.equal(evaluateGame(game({ playtime_2weeks: 30 }), NOW).status, 'jugando')
    })

    it('no cambia si la última partida es de hace más de 2 semanas', () => {
        const out = evaluateGame(game({ status: 'pendiente', rtime_last_played: daysAgo(20) }), NOW)
        assert.equal(out.status, 'pendiente')
        assert.equal(out.statusChanged, false)
    })

    for (const status of ['completado', 'abandonado', 'descartado'] as const) {
        it(`nunca toca ${status}`, () => {
            const out = evaluateGame(game({ status, status_source: 'manual', rtime_last_played: daysAgo(1), playtime_2weeks: 60 }), NOW)
            assert.equal(out.status, status)
            assert.equal(out.statusChanged, false)
            assert.equal(out.suggestion, null)
        })
    }

    it('respeta una decisión manual posterior a la última partida', () => {
        const out = evaluateGame(
            game({ status: 'pausado', status_source: 'manual', status_changed_at: daysAgo(1), rtime_last_played: daysAgo(3), playtime_2weeks: 90 }),
            NOW,
        )
        assert.equal(out.status, 'pausado')
        assert.equal(out.statusChanged, false)
    })

    it('una partida posterior a la decisión manual sí la revoca', () => {
        const out = evaluateGame(
            game({ status: 'pendiente', status_source: 'manual', status_changed_at: daysAgo(5), rtime_last_played: daysAgo(1) }),
            NOW,
        )
        assert.equal(out.status, 'jugando')
    })

    it('ya en jugando no cambia nada', () => {
        const out = evaluateGame(game({ status: 'jugando', rtime_last_played: daysAgo(1) }), NOW)
        assert.equal(out.statusChanged, false)
        assert.equal(out.suggestion, null)
    })
})

describe('Sugerencia de Pausado', () => {
    it('jugando y más de 30 días sin jugar', () => {
        const out = evaluateGame(game({ status: 'jugando', status_changed_at: daysAgo(60), rtime_last_played: daysAgo(31) }), NOW)
        assert.equal(out.suggestion, 'pausado')
        assert.equal(out.status, 'jugando')
    })

    it('no con 30 días o menos', () => {
        const out = evaluateGame(game({ status: 'jugando', status_changed_at: daysAgo(60), rtime_last_played: daysAgo(29) }), NOW)
        assert.equal(out.suggestion, null)
    })

    it('no si se marcó Jugando a mano hace poco, aunque no se haya jugado', () => {
        const out = evaluateGame(
            game({ status: 'jugando', status_source: 'manual', status_changed_at: daysAgo(5), rtime_last_played: daysAgo(90) }),
            NOW,
        )
        assert.equal(out.suggestion, null)
    })

    it('solo para jugando', () => {
        const out = evaluateGame(game({ status: 'pendiente', rtime_last_played: daysAgo(90) }), NOW)
        assert.equal(out.suggestion, null)
    })

    it('descartada no vuelve mientras no se juegue otra vez', () => {
        const base = { status: 'jugando' as const, status_changed_at: daysAgo(120), rtime_last_played: daysAgo(60) }
        assert.equal(evaluateGame(game({ ...base, suggestion_dismissed_at: daysAgo(10) }), NOW).suggestion, null)
        // Se juega después del descarte y se vuelve a dejar más de 30 días.
        const again = evaluateGame(game({ ...base, suggestion_dismissed_at: daysAgo(50), rtime_last_played: daysAgo(40) }), NOW)
        assert.equal(again.suggestion, 'pausado')
    })
})

describe('Sugerencia de Completado e insignia 100%', () => {
    const perfect = { achievements_total: 40, achievements_unlocked: 40, last_unlock_at: daysAgo(2) }

    it('isPerfect', () => {
        assert.equal(isPerfect(perfect), true)
        assert.equal(isPerfect({ achievements_total: 40, achievements_unlocked: 39 }), false)
        assert.equal(isPerfect({ achievements_total: 0, achievements_unlocked: 0 }), false)
        assert.equal(isPerfect({ achievements_total: null, achievements_unlocked: null }), false)
    })

    it('100% de logros sugiere completado', () => {
        const out = evaluateGame(game({ status: 'jugando', rtime_last_played: daysAgo(2), ...perfect }), NOW)
        assert.equal(out.suggestion, 'completado')
    })

    it('100% tiene prioridad sobre la sugerencia de pausado', () => {
        const out = evaluateGame(game({ status: 'jugando', rtime_last_played: daysAgo(90), ...perfect, last_unlock_at: daysAgo(90) }), NOW)
        assert.equal(out.suggestion, 'completado')
    })

    it('un juego de la bandeja que pasa a jugando y está al 100% también recibe la sugerencia', () => {
        const out = evaluateGame(game({ rtime_last_played: daysAgo(1), ...perfect }), NOW)
        assert.equal(out.status, 'jugando')
        assert.equal(out.suggestion, 'completado')
    })

    it('descartada no vuelve aunque se siga jugando, salvo que haya logros nuevos', () => {
        const base = { status: 'jugando' as const, rtime_last_played: daysAgo(0), ...perfect, suggestion_dismissed_at: daysAgo(1) }
        assert.equal(evaluateGame(game(base), NOW).suggestion, null)
        // Un DLC añade logros y se vuelven a completar después del descarte.
        assert.equal(evaluateGame(game({ ...base, last_unlock_at: daysAgo(0) }), NOW).suggestion, 'completado')
    })

    it('superar la duración de HowLongToBeat sugiere completado', () => {
        const base = { status: 'jugando' as const, rtime_last_played: daysAgo(1), playtime_forever: 900 }
        assert.equal(evaluateGame(game({ ...base, hltb_main_minutes: 600 }), NOW).suggestion, 'completado')
        assert.equal(evaluateGame(game({ ...base, hltb_main_minutes: 1200 }), NOW).suggestion, null)
        assert.equal(evaluateGame(game({ ...base, hltb_main_minutes: null }), NOW).suggestion, null)
    })

    it('según el objetivo (#24): extras mira su duración; 100 % con logros no se sugiere por horas', () => {
        const base = { status: 'jugando' as const, rtime_last_played: daysAgo(1), playtime_forever: 900, hltb_main_minutes: 600 }
        assert.equal(evaluateGame(game({ ...base, goal: 'extras', goal_minutes: 1200 }), NOW).suggestion, null)
        assert.equal(evaluateGame(game({ ...base, goal: 'extras', goal_minutes: 800 }), NOW).suggestion, 'completado')
        const logros = { achievements_total: 40, achievements_unlocked: 10, last_unlock_at: daysAgo(5) }
        assert.equal(evaluateGame(game({ ...base, ...logros, goal: 'completo', goal_minutes: 800 }), NOW).suggestion, null)
        // Sin logros, el 100 % se mide por horas.
        assert.equal(evaluateGame(game({ ...base, goal: 'completo', goal_minutes: 800 }), NOW).suggestion, 'completado')
    })

    it('sin final: nunca se sugiere completado por horas, pero sí con el 100 % de logros', () => {
        const base = { status: 'jugando' as const, rtime_last_played: daysAgo(1), playtime_forever: 9000, hltb_main_minutes: 600, goal: 'historia', goal_minutes: null }
        assert.equal(evaluateGame(game(base), NOW).suggestion, null)
        const todos = { achievements_total: 10, achievements_unlocked: 10, last_unlock_at: daysAgo(1) }
        assert.equal(evaluateGame(game({ ...base, ...todos }), NOW).suggestion, 'completado')
    })

    it('la de HowLongToBeat descartada no vuelve hasta que cambie el estado', () => {
        const base = { status: 'jugando' as const, rtime_last_played: daysAgo(1), playtime_forever: 900, hltb_main_minutes: 600 }
        assert.equal(evaluateGame(game({ ...base, status_changed_at: daysAgo(30), suggestion_dismissed_at: daysAgo(3) }), NOW).suggestion, null)
        assert.equal(evaluateGame(game({ ...base, status_changed_at: daysAgo(1), suggestion_dismissed_at: daysAgo(3) }), NOW).suggestion, 'completado')
    })
})

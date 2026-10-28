import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    daysAgo,
    dismissReason,
    formatHoursExact,
    goalBar,
    goalPhrase,
    groupSuggestions,
    limitGroups,
    suggestionEvidence,
    SUGGESTION_COPY,
} from './suggestions'
import { evaluateGame } from './tracker-rules'
import { libraryGame as game } from './test-utils'

const NOW = Date.parse('2026-10-28T12:00:00Z')
const ago = (d: number) => new Date(NOW - d * 86_400_000).toISOString()

describe('sugerencias: grupos y orden', () => {
    it('primero «por completar» y luego «por pausar», cada grupo por última partida', () => {
        const a = game({ appid: 1, suggestion: 'pausado', rtime_last_played: ago(40) })
        const b = game({ appid: 2, suggestion: 'completado', rtime_last_played: ago(8) })
        const c = game({ appid: 3, suggestion: 'pausado', rtime_last_played: ago(90) })
        const d = game({ appid: 4, suggestion: 'completado', rtime_last_played: ago(2) })
        const e = game({ appid: 5, suggestion: 'completado', rtime_last_played: null })
        const groups = groupSuggestions([a, b, c, d, e])
        assert.deepEqual(
            groups.map((g) => [g.kind, g.games.map((x) => x.appid)]),
            [
                ['completado', [4, 2, 5]],
                ['pausado', [1, 3]],
            ],
        )
    })

    it('sin grupos vacíos ni juegos sin sugerencia', () => {
        const groups = groupSuggestions([game({ suggestion: 'pausado', rtime_last_played: ago(40) }), game({ suggestion: null })])
        assert.deepEqual(
            groups.map((g) => g.kind),
            ['pausado'],
        )
        assert.deepEqual(groupSuggestions([]), [])
    })

    it('enseña las 4 primeras del panel y cuenta las ocultas', () => {
        const groups = [
            { kind: 'completado' as const, games: [1, 2, 3] },
            { kind: 'pausado' as const, games: [4, 5, 6] },
        ]
        const { groups: shown, hidden } = limitGroups(groups, 4)
        assert.deepEqual(shown, [
            { kind: 'completado', games: [1, 2, 3] },
            { kind: 'pausado', games: [4] },
        ])
        assert.equal(hidden, 2)
        assert.deepEqual(limitGroups(groups, 3).groups.map((g) => g.kind), ['completado'])
        assert.equal(limitGroups(groups, Infinity).hidden, 0)
    })
})

describe('sugerencias: la prueba', () => {
    it('100 % de logros: logros y días desde el último', () => {
        const g = game({ suggestion: 'completado', achievements_total: 49, achievements_unlocked: 49, last_unlock_at: ago(2), playtime_forever: 3500 })
        assert.deepEqual(suggestionEvidence(g, NOW), {
            kind: 'completado',
            why: 'logros',
            unlocked: 49,
            total: 49,
            lastUnlockAt: g.last_unlock_at,
            daysSinceUnlock: 2,
        })
    })

    it('más horas que la historia: horas frente a la meta', () => {
        const g = game({ suggestion: 'completado', goal: null, playtime_forever: 1890, hltb_main: 1620, achievements_total: 63, achievements_unlocked: 41 })
        assert.deepEqual(suggestionEvidence(g, NOW), { kind: 'completado', why: 'horas', minutes: 1890, targetMinutes: 1620, goal: 'historia' })
    })

    it('con objetivo «Historia + extras», la meta es la suya y se nombra', () => {
        const g = game({ suggestion: 'completado', goal: 'extras', playtime_forever: 2280, hltb_main: 1500, hltb_main_extra: 2100 })
        const ev = suggestionEvidence(g, NOW)
        assert.deepEqual(ev, { kind: 'completado', why: 'horas', minutes: 2280, targetMinutes: 2100, goal: 'extras' })
        assert.equal(goalPhrase('extras'), 'de historia + extras, tu objetivo')
        assert.equal(goalPhrase('extras', true), 'de historia + extras')
        assert.equal(goalPhrase('historia'), 'de historia')
    })

    it('coincide con la regla que genera la sugerencia (evaluateGame)', () => {
        const g = game({
            status: 'jugando',
            status_source: 'auto',
            goal: 'extras',
            playtime_forever: 2280,
            hltb_main: 1500,
            hltb_main_extra: 2100,
            rtime_last_played: ago(3),
        })
        const out = evaluateGame({ ...g, status_changed_at: g.status_changed_at!, status_source: g.status_source!, goal_minutes: 2100 }, NOW)
        assert.equal(out.suggestion, 'completado')
        assert.equal(suggestionEvidence({ ...g, suggestion: out.suggestion }, NOW)?.why, 'horas')
    })

    it('si la regla ya no se cumple, solo la pregunta', () => {
        const g = game({ suggestion: 'completado', playtime_forever: 100, hltb_main: 1620 })
        assert.deepEqual(suggestionEvidence(g, NOW), { kind: 'completado', why: 'otro' })
        assert.equal(suggestionEvidence(game({ suggestion: null }), NOW), null)
    })

    it('días sin jugar desde la última partida y dónde lo dejaste', () => {
        const g = game({
            suggestion: 'pausado',
            status: 'jugando',
            rtime_last_played: ago(46),
            status_changed_at: ago(120),
            playtime_forever: 3840,
            hltb_main: 4500,
        })
        assert.deepEqual(suggestionEvidence(g, NOW), {
            kind: 'pausado',
            why: 'inactivo',
            idleDays: 46,
            since: g.rtime_last_played,
            minutes: 3840,
            storyMinutes: 4500,
        })
    })

    it('si el estado cambió después de la última partida, cuenta desde el cambio', () => {
        const g = game({ suggestion: 'pausado', rtime_last_played: ago(80), status_changed_at: ago(35) })
        const ev = suggestionEvidence(g, NOW)
        assert.equal(ev?.why === 'inactivo' && ev.idleDays, 35)
        assert.equal(ev?.why === 'inactivo' && ev.since, g.status_changed_at)
    })
})

describe('sugerencias: cuándo vuelve a preguntar', () => {
    it('una frase por regla', () => {
        const logros = suggestionEvidence(game({ suggestion: 'completado', achievements_total: 10, achievements_unlocked: 10 }), NOW)
        const horas = suggestionEvidence(game({ suggestion: 'completado', goal: null, playtime_forever: 2000, hltb_main: 1000 }), NOW)
        const pausa = suggestionEvidence(game({ suggestion: 'pausado', rtime_last_played: ago(40) }), NOW)
        assert.equal(dismissReason(logros), 'No volveremos a preguntar hasta que consigas otro logro.')
        assert.equal(dismissReason(horas), 'No volveremos a preguntar hasta que cambies su estado.')
        assert.equal(dismissReason(pausa), 'Volveremos a preguntar si lo juegas y lo dejas otro mes.')
    })

    it('textos de las respuestas', () => {
        assert.equal(SUGGESTION_COPY.completado.no, 'Todavía no')
        assert.equal(SUGGESTION_COPY.pausado.no, 'Sigo con él')
    })
})

describe('sugerencias: formatos', () => {
    it('horas con un decimal si hace falta', () => {
        assert.equal(formatHoursExact(1890), '31,5 h')
        assert.equal(formatHoursExact(1620), '27 h')
        assert.equal(formatHoursExact(270), '4,5 h')
        assert.equal(formatHoursExact(45), '45 min')
    })

    it('hace cuánto', () => {
        assert.equal(daysAgo(0), 'hoy')
        assert.equal(daysAgo(1), 'ayer')
        assert.equal(daysAgo(2), 'hace 2 días')
        assert.equal(daysAgo(90), 'hace 3 meses')
    })

    it('barra frente a la meta: al pasarla se llena y la marca queda dentro', () => {
        assert.deepEqual(goalBar(1350, 2700), { fill: 0.5, mark: 1, over: false })
        const over = goalBar(1890, 1620)
        assert.equal(over.over, true)
        assert.equal(over.fill, 1)
        assert.ok(Math.abs(over.mark - 1620 / 1890) < 1e-9)
    })
})

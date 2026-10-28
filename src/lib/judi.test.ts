import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    attemptHistory,
    attemptSlots,
    findJudiLocalKey,
    judiCaptureUrl,
    judiShareText,
    nextOption,
    parseJudiDay,
    pointsAtStake,
    resultSummary,
    writeJudiLocal,
} from './judi'
import { getPointsForRecord } from './judi-ranking'

describe('JUDI en el servidor (#39)', () => {
    it('lee la respuesta de las RPC sin nombre mientras se juega', () => {
        const day = parseJudiDay({
            id: 268,
            fecha: '25-10-2026',
            phase: 3,
            capture_count: 7,
            hints: { generos: 'Simuladores', ccu: 2073 },
            nombre: null,
            header_image: null,
            appid: null,
            state: 'playing',
            failed: 2,
            guesses: ['Portal', 'Hades'],
            result: 'wrong',
        })
        assert.ok(day)
        assert.equal(day.phase, 3)
        assert.equal(day.nombre, null)
        assert.deepEqual(day.hints, { generos: 'Simuladores', ccu: 2073 })
        assert.deepEqual(day.guesses, ['Portal', 'Hades'])
        assert.equal(day.result, 'wrong')
    })

    it('respuestas raras: sin id es null, la fase se limita a 1-6', () => {
        assert.equal(parseJudiDay(null), null)
        assert.equal(parseJudiDay({ fecha: 'x' }), null)
        assert.equal(parseJudiDay({ id: 1, phase: 9 })?.phase, 6)
        assert.equal(parseJudiDay({ id: 1 })?.state, 'playing')
    })

    it('las capturas van por el proxy, sin la URL de Steam', () => {
        assert.equal(judiCaptureUrl(268, 1), '/api/judi/captura/268/1')
    })

    it('localStorage de invitados: lee la clave antigua fecha::appid y escribe por fecha', () => {
        const raw: Record<string, Record<string, unknown>> = { '24-10-2026::620': { completado: true }, '25-10-2026': { fase1: true } }
        assert.equal(findJudiLocalKey(raw, '24-10-2026'), '24-10-2026::620')
        assert.equal(findJudiLocalKey(raw, '25-10-2026'), '25-10-2026')
        assert.equal(findJudiLocalKey(raw, '23-10-2026'), undefined)

        const next = writeJudiLocal(raw, '24-10-2026', 267, { completado: true, nombre: 'Portal 2' })
        assert.deepEqual(Object.keys(next).sort(), ['24-10-2026', '25-10-2026'])
        assert.deepEqual(next['24-10-2026'], { completado: true, nombre: 'Portal 2' })
    })
})

describe('compartir resultado de JUDI (#38)', () => {
    const game = { id: 268, fecha: '25-10-2026' }
    it('acierto con fallos', () => {
        assert.equal(judiShareText(game, 'won', 2, 'https://x/judi'), 'JUDI #268 (25/10/2026) 3/6\n🟥🟥🟩⬛⬛⬛\nhttps://x/judi')
    })
    it('acierto a la primera y partida perdida', () => {
        assert.equal(judiShareText(game, 'won', 0, 'u').split('\n')[1], '🟩⬛⬛⬛⬛⬛')
        assert.equal(judiShareText(game, 'lost', 6, 'u'), 'JUDI #268 (25/10/2026) X/6\n🟥🟥🟥🟥🟥🟥\nu')
    })
})

describe('Intentos de JUDI (rediseño)', () => {
    it('parseJudiDay lee `attempts` con los saltos como null (y null sin la migración)', () => {
        assert.deepEqual(parseJudiDay({ id: 1, attempts: ['Portal', null, '  ', 'Hades'] })?.attempts, ['Portal', null, null, 'Hades'])
        assert.equal(parseJudiDay({ id: 1, guesses: ['Portal'] })?.attempts, null)
    })

    it('attemptHistory: exacto si `attempts` cuadra con los fallos', () => {
        const h = attemptHistory({ attempts: ['Dead Cells', null, 'Ori'], guesses: ['Dead Cells', 'Ori'], failed: 3 })
        assert.equal(h.exact, true)
        assert.deepEqual(h.attempts.map((a) => a.kind), ['miss', 'skip', 'miss'])
        assert.deepEqual(h.names, ['Dead Cells', 'Ori'])
    })

    it('attemptHistory: sin la migración (o partidas antiguas), fallos sin orden y los nombres aparte', () => {
        const old = attemptHistory({ attempts: null, guesses: ['Dead Cells'], failed: 2 })
        assert.equal(old.exact, false)
        assert.deepEqual(old.attempts, [{ kind: 'miss', name: null }, { kind: 'miss', name: null }])
        assert.deepEqual(old.names, ['Dead Cells'])
        // Acertado antes de la migración: el servidor borró los fallos.
        assert.deepEqual(attemptHistory({ attempts: [], guesses: [], failed: 3 }).names, [])
        assert.equal(attemptHistory({ attempts: [], guesses: [], failed: 3 }).exact, false)
        // Una partida a medias: el salto de antes no se guardó.
        assert.equal(attemptHistory({ attempts: ['A', null], failed: 3 }).exact, false)
        assert.deepEqual(attemptHistory({ attempts: [], failed: 0 }), { attempts: [], names: [], exact: true })
    })

    it('attemptSlots: hechos, el actual, el acierto, sin usar y bloqueados', () => {
        const att = attemptHistory({ attempts: ['A', null], failed: 2 }).attempts
        assert.deepEqual(attemptSlots('playing', att).map((s) => s.kind), ['miss', 'skip', 'current', 'locked', 'locked', 'locked'])
        assert.deepEqual(attemptSlots('won', att).map((s) => s.kind), ['miss', 'skip', 'hit', 'open', 'open', 'open'])
        assert.deepEqual(attemptSlots('won', []).map((s) => s.kind), ['hit', 'open', 'open', 'open', 'open', 'open'])
        const six = attemptHistory({ attempts: ['A', 'B', null, 'C', 'D', null], failed: 6 }).attempts
        assert.deepEqual(attemptSlots('lost', six).map((s) => s.kind), ['miss', 'miss', 'skip', 'miss', 'miss', 'skip'])
        assert.equal(attemptSlots('playing', att)[0].name, 'A')
    })

    it('pointsAtStake es la cuenta del ranking (saltar cuenta como fallar)', () => {
        for (let failed = 0; failed <= 5; failed++) {
            const flags = Object.fromEntries([1, 2, 3, 4, 5].map((f) => [`fase${f}`, f <= failed]))
            assert.equal(pointsAtStake(failed), getPointsForRecord({ completado: true, ...flags }))
        }
        assert.equal(pointsAtStake(0), 6)
        assert.equal(pointsAtStake(5), 1)
    })

    it('resultSummary', () => {
        const att = attemptHistory({ attempts: ['A', null], failed: 2 }).attempts
        assert.deepEqual(resultSummary('won', [], true), { title: '¡Acertado a la primera!', detail: 'Con solo la primera captura' })
        assert.deepEqual(resultSummary('won', att, true), { title: '¡Acertado en la fase 3!', detail: 'Tras 1 fallo y 1 saltado' })
        assert.equal(resultSummary('won', attemptHistory({ attempts: null, failed: 3 }).attempts, false).detail, 'Tras 3 intentos fallados')
        const lost = attemptHistory({ attempts: ['A', 'B', null, 'C', 'D', null], failed: 6 }).attempts
        assert.deepEqual(resultSummary('lost', lost, true), { title: 'Esta vez no', detail: '4 fallos y 2 saltados, sin dar con él' })
    })

    it('nextOption salta las ya probadas y da la vuelta', () => {
        assert.equal(nextOption([false, true, false], -1, 1), 0)
        assert.equal(nextOption([true, false], -1, 1), 1)
        assert.equal(nextOption([false, true, false], 0, 1), 2)
        assert.equal(nextOption([false, true, false], 2, 1), 0)
        assert.equal(nextOption([false, true, false], 0, -1), 2)
        assert.equal(nextOption([true, true], -1, 1), -1)
        assert.equal(nextOption([], -1, 1), -1)
    })
})

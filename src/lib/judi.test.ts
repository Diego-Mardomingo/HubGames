import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    attemptHistory,
    attemptSlots,
    dayAttempts,
    findJudiLocalKey,
    judiDayPoints,
    judiDayStatus,
    judiFilterCounts,
    judiIsoDate,
    judiOwnersLabel,
    judiMonths,
    judiStats,
    matchesJudiFilter,
    type JudiStatDay,
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
            hints: { generos: 'Simuladores', propietarios: '1,000,000 .. 2,000,000' },
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
        assert.deepEqual(day.hints, { generos: 'Simuladores', propietarios: '1,000,000 .. 2,000,000' })
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

describe('Tus estadísticas e historial de JUDI', () => {
    const d = (date: string, status: JudiStatDay['status'], failed = 0): JudiStatDay => ({ date, status, failed: status === 'lost' ? 6 : failed })

    it('judiDayStatus, judiIsoDate y puntos', () => {
        assert.equal(judiDayStatus({ completado: true }, 2), 'won')
        assert.equal(judiDayStatus({ fase6: true }, 6), 'lost')
        assert.equal(judiDayStatus({}, 2), 'progress')
        assert.equal(judiDayStatus({}, 0), 'new')
        assert.equal(judiIsoDate('05-03-2026'), '2026-03-05')
        assert.equal(judiIsoDate('5-3-2026'), '2026-03-05')
        assert.equal(judiIsoDate('2026/03/05'), null)
        assert.equal(judiDayPoints(d('2026-10-01', 'won', 2)), 4)
        assert.equal(judiDayPoints(d('2026-10-01', 'won', 5)), 1)
        assert.equal(judiDayPoints(d('2026-10-01', 'lost')), 0)
    })

    it('cuenta aciertos, fallos, puntos, % de acierto, media y reparto por intento', () => {
        const s = judiStats([d('2026-10-01', 'won', 0), d('2026-10-02', 'won', 2), d('2026-10-03', 'lost'), d('2026-10-04', 'progress', 1), d('2026-10-05', 'new')], '2026-10-05')
        assert.equal(s.wins, 2)
        assert.equal(s.losses, 1)
        assert.equal(s.progress, 1)
        assert.equal(s.unplayed, 1)
        assert.equal(s.played, 3)
        assert.equal(s.points, 6 + 4)
        assert.equal(s.accuracy, 67)
        assert.equal(s.avgAttempt, 2)
        assert.deepEqual(s.dist, [1, 0, 1, 0, 0, 0])
    })

    it('sin partidas: todo a cero y sin media', () => {
        const s = judiStats([d('2026-10-05', 'new')], '2026-10-05')
        assert.equal(s.played, 0)
        assert.equal(s.accuracy, 0)
        assert.equal(s.avgAttempt, null)
        assert.equal(s.streak, 0)
        assert.equal(s.best, 0)
        assert.equal(s.atRisk, false)
        assert.deepEqual(judiStats([], '2026-10-05').dist, [0, 0, 0, 0, 0, 0])
    })

    it('racha por fecha del JUDI: el de hoy sin terminar no la corta pero la pone en riesgo', () => {
        const days = [d('2026-10-01', 'lost'), d('2026-10-02', 'won'), d('2026-10-03', 'won'), d('2026-10-04', 'new')]
        const s = judiStats(days, '2026-10-04')
        assert.equal(s.streak, 2)
        assert.deepEqual(s.streakDates, ['2026-10-03', '2026-10-02'])
        assert.equal(s.streakFrom, '2026-10-02')
        assert.equal(s.atRisk, true)
        assert.equal(judiStats([...days.slice(0, 3), d('2026-10-04', 'progress', 2)], '2026-10-04').atRisk, true)
        const won = judiStats([...days.slice(0, 3), d('2026-10-04', 'won')], '2026-10-04')
        assert.equal(won.streak, 3)
        assert.equal(won.atRisk, false)
        assert.equal(judiStats([...days.slice(0, 3), d('2026-10-04', 'lost')], '2026-10-04').streak, 0)
    })

    it('un día pasado en curso o sin jugar corta la racha; el orden de entrada no importa', () => {
        assert.equal(judiStats([d('2026-10-01', 'won'), d('2026-10-02', 'new'), d('2026-10-03', 'won')], '2026-10-04').streak, 1)
        assert.equal(judiStats([d('2026-10-03', 'won'), d('2026-10-01', 'won'), d('2026-10-02', 'progress', 1)], '2026-10-04').streak, 1)
        // Sin el de hoy en la lista (hoy no hubo JUDI): cuenta hasta ayer.
        assert.equal(judiStats([d('2026-10-02', 'won'), d('2026-10-03', 'won')], '2026-10-04').streak, 2)
    })

    it('mejor racha con sus fechas, la primera si empatan, y si es la actual', () => {
        const s = judiStats([d('2026-09-01', 'won'), d('2026-09-02', 'won'), d('2026-09-03', 'won'), d('2026-09-04', 'lost'), d('2026-09-05', 'won'), d('2026-09-06', 'won')], '2026-09-07')
        assert.equal(s.best, 3)
        assert.equal(s.bestFrom, '2026-09-01')
        assert.equal(s.bestTo, '2026-09-03')
        assert.equal(s.bestIsCurrent, false)
        assert.equal(s.streak, 2)
        const tie = judiStats([d('2026-09-01', 'won'), d('2026-09-02', 'lost'), d('2026-09-03', 'won')], '2026-09-04')
        assert.equal(tie.bestFrom, '2026-09-01')
        assert.equal(tie.bestIsCurrent, false)
        const cur = judiStats([d('2026-09-01', 'lost'), d('2026-09-02', 'won'), d('2026-09-03', 'won'), d('2026-09-04', 'new')], '2026-09-04')
        assert.equal(cur.bestIsCurrent, true)
    })

    it('filtros, contadores y meses', () => {
        const days = [d('2026-09-30', 'won'), d('2026-10-01', 'lost'), d('2026-10-02', 'progress', 2), d('2026-10-03', 'new'), d('2026-10-04', 'won', 1)]
        assert.deepEqual(judiFilterCounts(days), { all: 5, won: 2, lost: 1, progress: 1, new: 1 })
        assert.equal(matchesJudiFilter(days[0], 'all'), true)
        assert.equal(matchesJudiFilter(days[0], 'lost'), false)
        const all = judiMonths(days, 'all')
        assert.deepEqual(all.map((m) => m.key), ['2026-10', '2026-09'])
        assert.deepEqual(all[0].all.map((x) => x.date), ['2026-10-04', '2026-10-03', '2026-10-02', '2026-10-01'])
        assert.deepEqual([all[0].won, all[0].lost, all[0].progress], [1, 1, 1])
        const lost = judiMonths(days, 'lost')
        assert.deepEqual(lost.map((m) => m.key), ['2026-10'])
        assert.equal(lost[0].shown.length, 1)
        assert.equal(lost[0].all.length, 4)
        assert.deepEqual(judiMonths(days, 'new').map((m) => m.key), ['2026-10'])
    })

    it('dayAttempts: con orden, sin la migración y partidas antiguas', () => {
        assert.deepEqual(dayAttempts(['A', null], 2), { attempts: [{ kind: 'miss', name: 'A' }, { kind: 'skip', name: null }], names: ['A'], exact: true })
        // Sin `attempts` (servidor sin la migración): fallos sin orden.
        assert.equal(dayAttempts(undefined, 3).exact, false)
        assert.equal(dayAttempts(undefined, 3).attempts.length, 3)
        // Acertado antes de la migración: se borraban los fallos.
        assert.deepEqual(dayAttempts([], 2).names, [])
        assert.equal(dayAttempts([], 2).exact, false)
        // Perdido antes: sin los saltos, quedan los nombres.
        assert.deepEqual(dayAttempts(['A', 'B'], 6).names, ['A', 'B'])
        // Sin intentos gastados (acierto a la primera, sin jugar): siempre exacto.
        assert.equal(dayAttempts(undefined, 0).exact, true)
    })
})

describe('judiOwnersLabel', () => {
    it('formatea los rangos de SteamSpy en español', () => {
        assert.equal(judiOwnersLabel('10,000,000 .. 20,000,000'), '10–20 millones')
        assert.equal(judiOwnersLabel('100,000,000 .. 200,000,000'), '100–200 millones')
        assert.equal(judiOwnersLabel('500,000 .. 1,000,000'), '500.000–1 millón')
        assert.equal(judiOwnersLabel('20,000 .. 50,000'), '20.000–50.000')
        assert.equal(judiOwnersLabel('0 .. 20,000'), 'menos de 20.000')
    })

    it('si no lo entiende, devuelve el texto tal cual', () => {
        assert.equal(judiOwnersLabel(' muchos '), 'muchos')
    })
})

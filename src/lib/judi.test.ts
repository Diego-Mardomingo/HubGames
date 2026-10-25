import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { findJudiLocalKey, judiCaptureUrl, parseJudiDay, writeJudiLocal } from './judi'

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
        const raw = { '24-10-2026::620': { completado: true }, '25-10-2026': { fase1: true } }
        assert.equal(findJudiLocalKey(raw, '24-10-2026'), '24-10-2026::620')
        assert.equal(findJudiLocalKey(raw, '25-10-2026'), '25-10-2026')
        assert.equal(findJudiLocalKey(raw, '23-10-2026'), undefined)

        const next = writeJudiLocal(raw, '24-10-2026', 267, { completado: true, nombre: 'Portal 2' })
        assert.deepEqual(Object.keys(next).sort(), ['24-10-2026', '25-10-2026'])
        assert.deepEqual(next['24-10-2026'], { completado: true, nombre: 'Portal 2' })
    })
})

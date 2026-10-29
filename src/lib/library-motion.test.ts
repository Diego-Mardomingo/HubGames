import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatHours } from './format'
import { hoursCount, markReachedAt, rowChange, statusPatch } from './library-motion'
import { libraryGame as game } from './test-utils'

describe('movimiento: qué le pasa a una fila', () => {
    it('sale de la lista, con el puesto que tenía', () => {
        assert.deepEqual(rowChange([1, 2, 3], [1, 3], 2), { kind: 'leave', index: 1 })
    })

    it('cambia de puesto (orden «Último cambio de estado»)', () => {
        assert.deepEqual(rowChange([1, 2, 3], [3, 1, 2], 3), { kind: 'move', from: 2, to: 0 })
    })

    it('se queda si solo cambia su chip o si sale otra fila de encima', () => {
        assert.deepEqual(rowChange([1, 2, 3], [1, 2, 3], 2), { kind: 'stay' })
        assert.deepEqual(rowChange([1, 2, 3], [2, 3], 3), { kind: 'stay' })
    })

    it('no estaba: entra sin más', () => {
        assert.deepEqual(rowChange([1, 2], [1, 2, 9], 9), { kind: 'none' })
    })
})

describe('movimiento: cambio de estado desde el menú', () => {
    const NOW = '2026-10-29T10:00:00.000Z'

    it('manual, sin sugerencia y con la fecha del cambio', () => {
        assert.deepEqual(statusPatch(game({ status: 'pendiente' }), 'pausado', NOW), {
            status: 'pausado',
            status_source: 'manual',
            suggestion: null,
            status_changed_at: NOW,
        })
    })

    it('Jugando fija started_at solo si no lo tenía', () => {
        assert.equal(statusPatch(game({ started_at: null }), 'jugando', NOW).started_at, NOW)
        assert.equal(statusPatch(game({ started_at: '2026-01-01T00:00:00.000Z' }), 'jugando', NOW).started_at, undefined)
    })

    it('Completado usa la fecha sugerida o, sin ella, ahora', () => {
        const unlock = '2026-10-20T18:00:00.000Z'
        assert.equal(statusPatch(game(), 'completado', NOW, unlock).completed_at, unlock)
        assert.equal(statusPatch(game(), 'completado', NOW, null).completed_at, NOW)
    })
})

describe('movimiento: horas que cuentan', () => {
    it('misma unidad y decimales que formatHours', () => {
        for (const m of [0, 45, 90, 510, 599, 600, 1290, 31200]) {
            const { value, decimals, suffix } = hoursCount(m)
            const text = `${value.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${suffix}`
            assert.equal(text, formatHours(m), `${m} min`)
        }
    })
})

describe('movimiento: metas de la pista', () => {
    it('la barra alcanza cada meta en proporción a su posición', () => {
        assert.equal(markReachedAt(1620, 2760), 1620 / 2760)
        assert.equal(markReachedAt(3000, 2760), 1)
        assert.equal(markReachedAt(600, 0), 1)
    })
})

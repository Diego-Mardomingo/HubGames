import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    formatHmsCountdown,
    isJudiMaintenance,
    madridDayAndTime,
    maintenanceReturn,
    maintenanceReturnLine,
    maintenanceText,
    parseMaintenanceUntil,
} from './judi-maintenance'

// 29 de octubre de 2026, 16:00 en Madrid (CET, UTC+1)
const NOW = Date.parse('2026-10-29T15:00:00Z')

describe('JUDI en mantenimiento', () => {
    it('solo «true» activa el mantenimiento', () => {
        assert.equal(isJudiMaintenance('true'), true)
        assert.equal(isJudiMaintenance(' true '), true)
        assert.equal(isJudiMaintenance('false'), false)
        assert.equal(isJudiMaintenance('1'), false)
        assert.equal(isJudiMaintenance(''), false)
        assert.equal(isJudiMaintenance(undefined), false)
    })

    it('lee la hora de vuelta en ISO y descarta lo que no lo es', () => {
        assert.equal(parseMaintenanceUntil('2026-10-29T18:30:00+01:00'), Date.parse('2026-10-29T17:30:00Z'))
        assert.equal(parseMaintenanceUntil(' 2026-10-29T17:30:00Z '), Date.parse('2026-10-29T17:30:00Z'))
        assert.equal(parseMaintenanceUntil(undefined), null)
        assert.equal(parseMaintenanceUntil(''), null)
        assert.equal(parseMaintenanceUntil('18:30'), null)
        assert.equal(parseMaintenanceUntil('mañana'), null)
        assert.equal(parseMaintenanceUntil('2026-13-45T99:00'), null)
    })

    it('sin hora: como siempre, «Vuelve en un rato»', () => {
        const ret = maintenanceReturn(null, NOW)
        assert.deepEqual(ret, { kind: 'unset' })
        assert.equal(maintenanceReturnLine(ret), 'Vuelve en un rato.')
        assert.match(maintenanceText('unset', true), /Vuelve en un rato\.$/)
    })

    it('en menos de un día: cuenta atrás con la hora de Madrid', () => {
        const ret = maintenanceReturn(Date.parse('2026-10-29T17:30:00Z'), NOW)
        assert.deepEqual(ret, { kind: 'soon', msLeft: 2.5 * 3600 * 1000, time: '18:30' })
        assert.equal(maintenanceReturnLine(ret), 'Vuelve hacia las 18:30.')
        // Pasada la medianoche también es cuenta atrás si falta menos de un día
        assert.equal(maintenanceReturn(Date.parse('2026-10-30T00:30:00Z'), NOW).kind, 'soon')
    })

    it('a un día o más: la fecha y la hora, sin cuenta atrás', () => {
        const ret = maintenanceReturn(Date.parse('2026-10-31T09:00:00Z'), NOW)
        assert.deepEqual(ret, { kind: 'later', when: 'sábado, 31 de octubre, hacia las 10:00' })
        assert.equal(maintenanceReturnLine(ret), 'Vuelve el sábado, 31 de octubre, hacia las 10:00.')
        assert.equal(madridDayAndTime(Date.parse('2026-07-01T08:00:00Z')), 'miércoles, 1 de julio, hacia las 10:00')
    })

    it('con la hora pasada: «Está tardando más de lo previsto»', () => {
        const until = Date.parse('2026-10-29T14:30:00Z')
        assert.deepEqual(maintenanceReturn(until, NOW), { kind: 'overdue', time: '15:30' })
        assert.deepEqual(maintenanceReturn(NOW, NOW), { kind: 'overdue', time: '16:00' })
        assert.match(maintenanceText('overdue', true), /Está tardando más de lo previsto/)
    })

    it('el texto depende de la sesión y nunca habla de la racha', () => {
        assert.match(maintenanceText('unset', true), /Tus partidas y tus puntos están guardados/)
        assert.match(maintenanceText('unset', false), /Tu progreso en este dispositivo está guardado/)
        for (const kind of ['unset', 'soon', 'later', 'overdue'] as const) {
            for (const signedIn of [true, false]) assert.doesNotMatch(maintenanceText(kind, signedIn), /racha/i)
        }
    })

    it('formatea la cuenta atrás y no baja de cero', () => {
        assert.equal(formatHmsCountdown((1 * 3600 + 42 * 60 + 10) * 1000 + 999), '01:42:10')
        assert.equal(formatHmsCountdown(-5000), '00:00:00')
    })
})

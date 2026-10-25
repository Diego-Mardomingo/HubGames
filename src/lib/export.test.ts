import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { achievementRows, exportFileName, libraryRows, toCsv } from './export'
import { libraryGame as game } from './test-utils'

describe('exportar tus datos (#34)', () => {
    it('biblioteca con notas, reseñas, fechas y horas', () => {
        const rows = libraryRows([
            game({ appid: 2, name: 'Zelda', playtime_forever: 95 }),
            game({ appid: 1, name: 'Ápex', status: 'completado', rating: 8.5, review: 'Muy bueno; "épico"', completed_at: '2026-10-01T10:00:00Z' }),
        ])
        assert.deepEqual(rows.map((r) => r.nombre), ['Ápex', 'Zelda'])
        assert.equal(rows[0].nota, 8.5)
        assert.equal(rows[1].horas, 1.6)
        assert.equal(rows[0].completado, '2026-10-01T10:00:00Z')
    })

    it('CSV para Excel en español: BOM, ;, decimales con coma y comillas escapadas', () => {
        const csv = toCsv(
            [
                { nombre: 'Ápex', nota: 8.5, resena: 'Muy bueno; "épico"' },
                { nombre: 'Zelda', nota: null, resena: null },
            ],
            ['nombre', 'nota', 'resena'],
        )
        assert.equal(csv, '﻿nombre;nota;resena\r\nÁpex;8,5;"Muy bueno; ""épico"""\r\nZelda;;\r\n')
    })

    it('logros ordenados por fecha y nombre de archivo con la fecha', () => {
        const rows = achievementRows([
            { appid: 1, game: 'A', apiname: 'B', display_name: null, unlocktime: '2026-02-01T00:00:00Z', global_percent: 3.2 },
            { appid: 1, game: 'A', apiname: 'A1', display_name: 'Primero', unlocktime: '2025-01-01T00:00:00Z', global_percent: 50 },
        ])
        assert.deepEqual(rows.map((r) => r.logro), ['Primero', 'B'])
        assert.equal(exportFileName('logros', 'csv', new Date('2026-10-25T12:00:00Z')), 'hubgames-logros-2026-10-25.csv')
    })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { closestRoute, editDistance, normalizePath } from './routes'

describe('rutas para la 404', () => {
    it('normaliza la ruta pedida', () => {
        assert.equal(normalizePath('/Biblioteca/'), '/biblioteca')
        assert.equal(normalizePath('/estad%C3%ADsticas?x=1#y'), '/estadisticas')
        assert.equal(normalizePath('//logros//historial'), '/logros/historial')
        assert.equal(normalizePath('wishlist'), '/wishlist')
        assert.equal(normalizePath('/'), '/')
        assert.equal(normalizePath('/%E0%A4%A'), '/%e0%a4%a')
    })

    it('distancia de edición', () => {
        assert.equal(editDistance('', ''), 0)
        assert.equal(editDistance('abc', ''), 3)
        assert.equal(editDistance('/bibloteca', '/biblioteca'), 1)
        assert.equal(editDistance('kitten', 'sitting'), 3)
    })

    it('sugiere la ruta con una errata', () => {
        assert.equal(closestRoute('/bibloteca')?.href, '/biblioteca')
        assert.equal(closestRoute('/logro')?.href, '/logros')
        assert.equal(closestRoute('/Estadísticas')?.label, 'Estadísticas')
        assert.equal(closestRoute('/estadisticas/resumn')?.href, '/estadisticas/resumen')
        assert.equal(closestRoute('/rankig')?.href, '/ranking')
        assert.equal(closestRoute('/biblioteca/bandja')?.href, '/biblioteca/bandeja')
    })

    it('si no hay errata, la ruta conocida que es su principio', () => {
        assert.equal(closestRoute('/biblioteca/xyz')?.href, '/biblioteca')
        assert.equal(closestRoute('/estadisticas/resumen/2031')?.href, '/estadisticas/resumen')
        assert.equal(closestRoute('/logros/historial/2019/invierno')?.href, '/logros/historial')
    })

    it('nada si no se parece a ninguna o ya existe', () => {
        assert.equal(closestRoute('/'), null)
        assert.equal(closestRoute('/biblioteca'), null)
        assert.equal(closestRoute('/cosas-que-no-existen'), null)
        assert.equal(closestRoute('/juego/123/otra'), null)
        assert.equal(closestRoute('/x'), null)
    })
})

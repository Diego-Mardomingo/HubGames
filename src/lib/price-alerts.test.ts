import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { alertLabel, alertPayload, decideAlert, meetsAlert, parseEuros, type AlertGame, type PriceAlert } from './price-alerts'

function game(over: Partial<AlertGame> = {}): AlertGame {
    return { appid: 620, name: 'Portal 2', price_initial: 999, price_final: 999, discount_percent: 0, steam_low: 199, ...over }
}

function alert(over: Partial<PriceAlert> = {}): PriceAlert {
    return { mode: 'minimo', target_price: null, target_discount: null, last_notified_price: null, ...over }
}

describe('avisos de precio (#37)', () => {
    it('por defecto, mínimo histórico en Steam y solo si está rebajado', () => {
        assert.equal(meetsAlert(game({ price_final: 199, discount_percent: 80 }), alert()), true)
        assert.equal(meetsAlert(game({ price_final: 299, discount_percent: 70 }), alert()), false)
        // Nunca rebajado: aunque el precio sea el "mínimo", no avisa.
        assert.equal(meetsAlert(game({ price_final: 999, steam_low: 999 }), alert()), false)
        assert.deepEqual(decideAlert(game({ price_final: 199, discount_percent: 80 }), null), { action: 'notify', price: 199 })
    })

    it('precio objetivo y descuento mínimo', () => {
        assert.equal(meetsAlert(game({ price_final: 500, discount_percent: 50 }), alert({ mode: 'precio', target_price: 500 })), true)
        assert.equal(meetsAlert(game({ price_final: 501 }), alert({ mode: 'precio', target_price: 500 })), false)
        assert.equal(meetsAlert(game({ price_final: 499, discount_percent: 50 }), alert({ mode: 'descuento', target_discount: 50 })), true)
        assert.equal(meetsAlert(game({ price_final: 599, discount_percent: 40 }), alert({ mode: 'descuento', target_discount: 50 })), false)
        assert.equal(meetsAlert(game({ price_final: 0, discount_percent: 100 }), alert({ mode: 'off' })), false)
        assert.equal(meetsAlert(game({ price_final: null }), alert({ mode: 'precio', target_price: 5000 })), false)
    })

    it('no repite mientras dura la oferta; vuelve a avisar si baja más o en la siguiente', () => {
        const low = game({ price_final: 199, discount_percent: 80 })
        assert.deepEqual(decideAlert(low, alert({ last_notified_price: 199 })), { action: 'none' })
        assert.deepEqual(decideAlert(game({ price_final: 149, steam_low: 149, discount_percent: 85 }), alert({ last_notified_price: 199 })), {
            action: 'notify',
            price: 149,
        })
        // Acaba la oferta: se olvida lo avisado.
        assert.deepEqual(decideAlert(game(), alert({ last_notified_price: 199 })), { action: 'reset' })
        assert.deepEqual(decideAlert(game(), alert()), { action: 'none' })
    })

    it('texto de la notificación y enlace a la ficha', () => {
        const p = alertPayload(game({ price_final: 199, discount_percent: 80 }), null)
        assert.equal(p.url, '/juego/620')
        assert.match(p.title, /^Portal 2 a 1,99\s€ \(-80%\)$/)
        assert.match(alertPayload(game({ price_final: 450, discount_percent: 55 }), alert({ mode: 'precio', target_price: 500 })).body, /precio objetivo \(5,00\s€\)/)
        assert.equal(alertLabel(alert({ mode: 'descuento', target_discount: 75 })), 'Aviso con -75% o más')
    })

    it('lee euros escritos a mano', () => {
        assert.equal(parseEuros('12,99'), 1299)
        assert.equal(parseEuros('5 €'), 500)
        assert.equal(parseEuros('7.5'), 750)
        assert.equal(parseEuros('abc'), null)
        assert.equal(parseEuros('1,999'), null)
    })
})

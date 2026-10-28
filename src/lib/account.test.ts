import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { emailLooksValid, passwordMismatch, passwordRules, usernameIssue } from './account'

describe('reglas de la cuenta', () => {
    it('nombre de usuario: vacío, igual, corto o comprobable', () => {
        assert.equal(usernameIssue('diego', 'diego'), 'same')
        assert.equal(usernameIssue(' diego ', 'diego'), 'same')
        assert.equal(usernameIssue('di', 'diego'), 'short')
        assert.equal(usernameIssue('diego2', 'diego'), null)
        // Registro: sin nombre actual
        assert.equal(usernameIssue('   '), 'empty')
        assert.equal(usernameIssue('la'), 'short')
        assert.equal(usernameIssue(' lau '), null)
    })

    it('reglas de la contraseña', () => {
        assert.deepEqual(passwordRules('', ''), { len: false, eq: null })
        assert.deepEqual(passwordRules('secreto', ''), { len: true, eq: null })
        assert.deepEqual(passwordRules('secreto', 'secret'), { len: true, eq: false })
        assert.deepEqual(passwordRules('secreto', 'secreto'), { len: true, eq: true })
        assert.equal(passwordRules('12345', '').len, false)
        assert.equal(passwordRules('123456', '').len, true)
    })

    it('«no coinciden» solo cuando la confirmación ya es igual de larga', () => {
        assert.equal(passwordMismatch('hubgames', 'hub'), false)
        assert.equal(passwordMismatch('hubgames', 'hubgamez'), true)
        assert.equal(passwordMismatch('hubgames', 'hubgames'), false)
        assert.equal(passwordMismatch('hubgames', ''), false)
    })

    it('formato del email', () => {
        assert.equal(emailLooksValid('laura@gmail.com'), true)
        assert.equal(emailLooksValid('  laura@gmail.com '), true)
        assert.equal(emailLooksValid('laura@gmail'), false)
        assert.equal(emailLooksValid('laura gomez@gmail.com'), false)
        assert.equal(emailLooksValid(''), false)
    })
})

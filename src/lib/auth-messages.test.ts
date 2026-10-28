import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    CREDENTIALS_MESSAGE,
    GENERIC_SIGN_IN_MESSAGE,
    OFFLINE_MESSAGE,
    RATE_LIMIT_MESSAGE,
    errorText,
    isNetworkError,
    isRateLimited,
    missingFieldsMessage,
    signInErrorMessage,
    welcomeMessage,
} from './auth-messages'

describe('mensajes del login', () => {
    it('campos vacíos: dice cuál falta y lo marca', () => {
        assert.equal(missingFieldsMessage('diego@hubgames.es', 'secreto'), null)
        assert.deepEqual(missingFieldsMessage('diego@hubgames.es', '')?.fields, ['password'])
        assert.equal(missingFieldsMessage('diego@hubgames.es', '')?.text, 'Te falta la contraseña.')
        assert.equal(missingFieldsMessage('   ', 'secreto')?.text, 'Te falta el email.')
        assert.deepEqual(missingFieldsMessage('', '')?.fields, ['email', 'password'])
        assert.equal(missingFieldsMessage('', '')?.tone, 'error')
    })

    it('credenciales incorrectas: por código o por el texto de GoTrue', () => {
        assert.equal(signInErrorMessage({ name: 'AuthApiError', status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' }), CREDENTIALS_MESSAGE)
        // Servidores antiguos sin `code`
        assert.equal(signInErrorMessage({ name: 'AuthApiError', status: 400, message: 'Invalid login credentials' }), CREDENTIALS_MESSAGE)
        assert.deepEqual(CREDENTIALS_MESSAGE.fields, ['email', 'password'])
    })

    it('sin conexión: AuthRetryableFetchError con estado 0, fetch que falla o navegador sin red', () => {
        const net = { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' }
        assert.equal(isNetworkError(net), true)
        assert.equal(signInErrorMessage(net), OFFLINE_MESSAGE)
        assert.equal(isNetworkError({ name: 'TypeError', message: 'Failed to fetch' }), true)
        assert.equal(isNetworkError({ name: 'TypeError', message: 'NetworkError when attempting to fetch resource.' }), true)
        assert.equal(isNetworkError({ name: 'TypeError', message: 'Load failed' }), true)
        assert.equal(signInErrorMessage({ name: 'AuthApiError', status: 500, message: '?' }, false), OFFLINE_MESSAGE)
        // Un 503 también es «reintentable», pero el servidor respondió: genérico
        assert.equal(isNetworkError({ name: 'AuthRetryableFetchError', status: 503 }), false)
        assert.equal(signInErrorMessage({ name: 'AuthRetryableFetchError', status: 503, message: 'HTTP 503' }), GENERIC_SIGN_IN_MESSAGE)
        assert.equal(isNetworkError(null), false)
    })

    it('demasiados intentos: 429 u over_*_rate_limit, en ámbar', () => {
        assert.equal(isRateLimited({ status: 429 }), true)
        assert.equal(isRateLimited({ status: 400, code: 'over_request_rate_limit' }), true)
        assert.equal(isRateLimited({ code: 'over_email_send_rate_limit' }), true)
        assert.equal(isRateLimited({ status: 400, code: 'validation_failed' }), false)
        const msg = signInErrorMessage({ name: 'AuthApiError', status: 429, code: 'over_request_rate_limit', message: 'Request rate limit reached' })
        assert.equal(msg, RATE_LIMIT_MESSAGE)
        assert.equal(msg.tone, 'warn')
    })

    it('el resto, genérico (también sin error)', () => {
        assert.equal(signInErrorMessage({ name: 'AuthApiError', status: 400, code: 'email_not_confirmed' }), GENERIC_SIGN_IN_MESSAGE)
        assert.equal(signInErrorMessage({ name: 'AuthUnknownError', message: 'Unexpected token' }), GENERIC_SIGN_IN_MESSAGE)
        assert.equal(signInErrorMessage(undefined), GENERIC_SIGN_IN_MESSAGE)
    })

    it('al entrar saluda con el nombre si lo hay', () => {
        assert.equal(welcomeMessage('diego').text, 'Hola de nuevo, diego.')
        assert.equal(welcomeMessage('  ').text, 'Hola de nuevo.')
        assert.equal(welcomeMessage(null).tone, 'ok')
        assert.equal(welcomeMessage('diego').sub, 'Abriendo tu Inicio…')
    })

    it('texto suelto → error con alerta', () => {
        assert.deepEqual(errorText('Las contraseñas no coinciden'), { tone: 'error', icon: 'alert', text: 'Las contraseñas no coinciden' })
    })
})

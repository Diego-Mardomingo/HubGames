import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    CREDENTIALS_MESSAGE,
    GENERIC_SIGN_IN_MESSAGE,
    OFFLINE_MESSAGE,
    RATE_LIMIT_MESSAGE,
    GENERIC_SIGN_UP_MESSAGE,
    emailTakenMessage,
    errorText,
    isNetworkError,
    isRateLimited,
    missingFieldsMessage,
    registerIssues,
    registerIssuesMessage,
    signInErrorMessage,
    signUpErrorMessage,
    signUpWelcomeMessage,
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

describe('mensajes del registro', () => {
    const ok = { username: 'laurita', email: 'laura@gmail.com', password: 'hubgames', confirm: 'hubgames', availability: 'free' as const }

    it('sin problemas, nada que decir', () => {
        assert.deepEqual(registerIssues(ok), [])
        assert.equal(registerIssuesMessage([]), null)
    })

    it('cada campo con su problema, en el orden del formulario', () => {
        const issues = registerIssues({ username: 'la', email: 'laura@gmail', password: 'hub', confirm: '', availability: 'short' })
        assert.deepEqual(issues.map((i) => i.field), ['username', 'email', 'password', 'confirm'])
        const msg = registerIssuesMessage(issues)
        assert.equal(msg?.text, 'Revisa los campos marcados.')
        assert.deepEqual(msg?.fields, ['username', 'email', 'password', 'confirm'])
    })

    it('un solo problema: su texto', () => {
        assert.equal(registerIssuesMessage(registerIssues({ ...ok, email: '' }))?.text, 'Te falta el email.')
        assert.equal(registerIssuesMessage(registerIssues({ ...ok, confirm: 'hubgamez' }))?.text, 'Las contraseñas no coinciden.')
        assert.equal(registerIssuesMessage(registerIssues({ ...ok, password: '12345', confirm: '12345' }))?.text, 'La contraseña necesita al menos 6 caracteres.')
        const taken = registerIssuesMessage(registerIssues({ ...ok, username: ' laura_g ', availability: 'taken' }))
        assert.equal(taken?.text, '«laura_g» ya está en uso.')
        assert.equal(taken?.sub, 'Prueba con otro.')
        assert.deepEqual(taken?.fields, ['username'])
    })

    it('email ya registrado: por código, con «Iniciar sesión» que lleva el email', () => {
        for (const code of ['user_already_exists', 'email_exists']) {
            const msg = signUpErrorMessage({ name: 'AuthApiError', status: 422, code }, ' laura+hub@gmail.com ')
            assert.equal(msg.text, 'Ya hay una cuenta con este email.')
            assert.deepEqual(msg.fields, ['email'])
            assert.equal(msg.action?.href, '/login?email=laura%2Bhub%40gmail.com')
        }
        assert.equal(emailTakenMessage('a@b.es').sub, 'a@b.es ya tiene cuenta en HubGames. ¿Es tuya? Entra con ella.')
    })

    it('contraseña débil: el motivo del servidor', () => {
        const pwned = signUpErrorMessage({ name: 'AuthWeakPasswordError', status: 422, code: 'weak_password', reasons: ['pwned'] }, 'a@b.es')
        assert.equal(pwned.text, 'La contraseña no vale.')
        assert.equal(pwned.sub, 'Aparece en filtraciones conocidas: elige otra.')
        assert.deepEqual(pwned.fields, ['password'])
        assert.equal(signUpErrorMessage({ code: 'weak_password', reasons: ['length'] }, 'a@b.es').sub, 'Necesita al menos 6 caracteres.')
        assert.equal(signUpErrorMessage({ code: 'weak_password' }, 'a@b.es').sub, undefined)
    })

    it('email que el servidor no acepta, red, límite y genérico', () => {
        assert.deepEqual(signUpErrorMessage({ code: 'email_address_invalid', status: 400 }, 'x@y.z').fields, ['email'])
        assert.equal(signUpErrorMessage({ code: 'validation_failed', status: 400 }, 'x@y.z').text, 'Ese email no es válido.')
        assert.equal(signUpErrorMessage({ name: 'AuthRetryableFetchError', status: 0 }, 'x@y.z'), OFFLINE_MESSAGE)
        assert.equal(signUpErrorMessage({ status: 500 }, 'x@y.z', false), OFFLINE_MESSAGE)
        assert.equal(signUpErrorMessage({ status: 429, code: 'over_request_rate_limit' }, 'x@y.z'), RATE_LIMIT_MESSAGE)
        assert.equal(signUpErrorMessage({ code: 'signup_disabled', status: 422 }, 'x@y.z'), GENERIC_SIGN_UP_MESSAGE)
        assert.equal(signUpErrorMessage(null, 'x@y.z'), GENERIC_SIGN_UP_MESSAGE)
    })

    it('cuenta creada: sin género', () => {
        assert.equal(signUpWelcomeMessage('laurita').text, 'Ya estás dentro, laurita.')
        assert.equal(signUpWelcomeMessage('').text, 'Ya estás dentro.')
        assert.equal(signUpWelcomeMessage('laurita').sub, 'Abriendo tu Inicio para conectar Steam…')
    })
})

/**
 * Mensajes del login (y del registro): qué decir, con qué tono y qué campos marcar.
 * Tono: `error` (--danger) para lo que falla, `warn` (--warning) para lo que no es culpa tuya o se arregla esperando,
 * `ok` (--success) al entrar. Siempre con icono y texto, nunca solo color.
 */

export type AuthTone = 'error' | 'warn' | 'ok'
export type AuthIcon = 'alert' | 'offline' | 'clock' | 'check'
export type AuthField = 'email' | 'password'

export type AuthMessage = {
    tone: AuthTone
    icon: AuthIcon
    text: string
    /** Segunda línea, más suave. */
    sub?: string
    /** Campos que se marcan en rojo (se desmarcan al escribir en ellos). */
    fields?: AuthField[]
}

/** Lo que nos interesa de un error de supabase-js (`AuthApiError`, `AuthRetryableFetchError`…) o de cualquier `Error`. */
export type AuthErrorLike = {
    name?: string
    status?: number
    code?: string
    message?: string
}

/** Campos vacíos: dice cuál falta y lo marca. `null` si están los dos. */
export function missingFieldsMessage(email: string, password: string): AuthMessage | null {
    const noEmail = !email.trim()
    const noPassword = !password
    if (!noEmail && !noPassword) return null
    if (noEmail && noPassword) {
        return { tone: 'error', icon: 'alert', text: 'Escribe tu email y tu contraseña.', fields: ['email', 'password'] }
    }
    return noEmail
        ? { tone: 'error', icon: 'alert', text: 'Te falta el email.', fields: ['email'] }
        : { tone: 'error', icon: 'alert', text: 'Te falta la contraseña.', fields: ['password'] }
}

export const CREDENTIALS_MESSAGE: AuthMessage = {
    tone: 'error',
    icon: 'alert',
    text: 'Email o contraseña incorrectos.',
    fields: ['email', 'password'],
}
export const OFFLINE_MESSAGE: AuthMessage = { tone: 'error', icon: 'offline', text: 'Sin conexión.', sub: 'Comprueba tu red y vuelve a probar.' }
export const RATE_LIMIT_MESSAGE: AuthMessage = {
    tone: 'warn',
    icon: 'clock',
    text: 'Demasiados intentos.',
    sub: 'Espera un minuto y vuelve a probar.',
}
export const GENERIC_SIGN_IN_MESSAGE: AuthMessage = { tone: 'error', icon: 'alert', text: 'No se pudo iniciar sesión. Inténtalo de nuevo.' }
/** Vuelta de `/auth/callback` con `?error=oauth`. */
export const OAUTH_RETURN_MESSAGE: AuthMessage = {
    tone: 'error',
    icon: 'alert',
    text: 'No se pudo completar el inicio de sesión con Google. Inténtalo de nuevo.',
}
/** `signInWithOAuth` devuelve error antes de redirigir. */
export const OAUTH_START_MESSAGE: AuthMessage = { tone: 'error', icon: 'alert', text: 'No se pudo abrir Google. Inténtalo de nuevo.' }

/** ¿Es un fallo de red? supabase-js lo da como `AuthRetryableFetchError` con estado 0 (el `fetch` no llegó a responder). */
export function isNetworkError(error: AuthErrorLike | null | undefined): boolean {
    if (!error) return false
    if (error.name === 'AuthRetryableFetchError' && (error.status ?? 0) === 0) return true
    // `fetch` lanzado fuera de supabase-js: «Failed to fetch» (Chrome), «NetworkError…» (Firefox), «Load failed» (Safari)
    return error.name === 'TypeError' && /failed to fetch|networkerror|load failed/i.test(error.message ?? '')
}

/** ¿Límite de peticiones? GoTrue responde 429 con `over_request_rate_limit` (u otro `over_*_rate_limit`). */
export function isRateLimited(error: AuthErrorLike | null | undefined): boolean {
    if (!error) return false
    return error.status === 429 || /^over_.*_rate_limit$/.test(error.code ?? '')
}

/**
 * Error de `signInWithPassword` (o lo que lance la llamada) → mensaje.
 * `online`: `navigator.onLine`; si es `false`, cualquier fallo se cuenta como «Sin conexión».
 */
export function signInErrorMessage(error: AuthErrorLike | null | undefined, online = true): AuthMessage {
    if (error?.code === 'invalid_credentials' || /invalid login credentials/i.test(error?.message ?? '')) return CREDENTIALS_MESSAGE
    if (!online || isNetworkError(error)) return OFFLINE_MESSAGE
    if (isRateLimited(error)) return RATE_LIMIT_MESSAGE
    return GENERIC_SIGN_IN_MESSAGE
}

/** Al entrar: «Hola de nuevo, diego.» mientras se abre el Inicio. */
export function welcomeMessage(username: string | null | undefined): AuthMessage {
    const name = username?.trim()
    return { tone: 'ok', icon: 'check', text: name ? `Hola de nuevo, ${name}.` : 'Hola de nuevo.', sub: 'Abriendo tu Inicio…' }
}

/** Mensaje suelto (los del registro, que todavía son texto): error con el icono de alerta. */
export function errorText(text: string): AuthMessage {
    return { tone: 'error', icon: 'alert', text }
}

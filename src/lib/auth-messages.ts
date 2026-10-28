import { PASSWORD_MIN, USERNAME_MIN, emailLooksValid, passwordRules } from './account'

/**
 * Mensajes del login (y del registro): qué decir, con qué tono y qué campos marcar.
 * Tono: `error` (--danger) para lo que falla, `warn` (--warning) para lo que no es culpa tuya o se arregla esperando,
 * `ok` (--success) al entrar. Siempre con icono y texto, nunca solo color.
 */

export type AuthTone = 'error' | 'warn' | 'ok'
export type AuthIcon = 'alert' | 'offline' | 'clock' | 'check'
export type AuthField = 'username' | 'email' | 'password' | 'confirm'

export type AuthMessage = {
    tone: AuthTone
    icon: AuthIcon
    text: string
    /** Segunda línea, más suave. */
    sub?: string
    /** Campos que se marcan en rojo (se desmarcan al escribir en ellos). */
    fields?: AuthField[]
    /** Enlace bajo el aviso («Iniciar sesión» desde «Ya hay una cuenta con este email»). */
    action?: { label: string; href: string }
}

/** Lo que nos interesa de un error de supabase-js (`AuthApiError`, `AuthRetryableFetchError`…) o de cualquier `Error`. */
export type AuthErrorLike = {
    name?: string
    status?: number
    code?: string
    message?: string
    /** `AuthWeakPasswordError`: por qué no vale (`length`, `characters`, `pwned`). */
    reasons?: string[]
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

// ── Registro ──


export type RegisterInput = {
    username: string
    email: string
    password: string
    confirm: string
    /** Resultado de `hubgames_username_available` (o `short`/`idle`/`checking`). */
    availability: 'idle' | 'short' | 'checking' | 'free' | 'taken'
}

/** Problema de un campo del registro: qué campo y qué decir si es el único. */
export type RegisterIssue = { field: AuthField; text: string; sub?: string }

/** Lo que impide enviar el registro, campo a campo y en el orden del formulario. */
export function registerIssues(input: RegisterInput): RegisterIssue[] {
    const issues: RegisterIssue[] = []
    const name = input.username.trim()
    if (!name) issues.push({ field: 'username', text: 'Te falta el nombre de usuario.' })
    else if (name.length < USERNAME_MIN) issues.push({ field: 'username', text: `El nombre necesita al menos ${USERNAME_MIN} caracteres.` })
    else if (input.availability === 'taken') issues.push({ field: 'username', text: `«${name}» ya está en uso.`, sub: 'Prueba con otro.' })
    if (!input.email.trim()) issues.push({ field: 'email', text: 'Te falta el email.' })
    else if (!emailLooksValid(input.email)) issues.push({ field: 'email', text: 'Revisa el email: no parece válido.' })
    const rules = passwordRules(input.password, input.confirm)
    if (!input.password) issues.push({ field: 'password', text: 'Te falta la contraseña.' })
    else if (!rules.len) issues.push({ field: 'password', text: `La contraseña necesita al menos ${PASSWORD_MIN} caracteres.` })
    if (!input.confirm) issues.push({ field: 'confirm', text: 'Repite la contraseña para confirmarla.' })
    else if (rules.eq === false) issues.push({ field: 'confirm', text: 'Las contraseñas no coinciden.' })
    return issues
}

/** Aviso para los problemas del registro: el del campo si es uno, «Revisa los campos marcados.» si son varios. */
export function registerIssuesMessage(issues: RegisterIssue[]): AuthMessage | null {
    if (!issues.length) return null
    const fields = issues.map((i) => i.field)
    if (issues.length > 1) return { tone: 'error', icon: 'alert', text: 'Revisa los campos marcados.', fields }
    const [first] = issues
    return { tone: 'error', icon: 'alert', text: first.text, sub: first.sub, fields }
}

const WEAK_REASONS: Record<string, string> = {
    length: `Necesita al menos ${PASSWORD_MIN} caracteres.`,
    characters: 'Mezcla letras, números y símbolos.',
    pwned: 'Aparece en filtraciones conocidas: elige otra.',
}

/** «Ya hay una cuenta con este email», con «Iniciar sesión» que lleva el email al login. */
export function emailTakenMessage(email: string): AuthMessage {
    const clean = email.trim()
    return {
        tone: 'error',
        icon: 'alert',
        text: 'Ya hay una cuenta con este email.',
        sub: `${clean} ya tiene cuenta en HubGames. ¿Es tuya? Entra con ella.`,
        fields: ['email'],
        action: { label: 'Iniciar sesión', href: `/login?email=${encodeURIComponent(clean)}` },
    }
}

export const GENERIC_SIGN_UP_MESSAGE: AuthMessage = { tone: 'error', icon: 'alert', text: 'No se pudo crear la cuenta. Inténtalo de nuevo.' }

/**
 * Error de `signUp` (o lo que lance la llamada) → mensaje. GoTrue: email repetido `user_already_exists` / `email_exists` (422);
 * contraseña débil `AuthWeakPasswordError` (`weak_password`, con `reasons`); email que no acepta `email_address_invalid`
 * o `validation_failed`; red y límite de peticiones como en el login.
 */
export function signUpErrorMessage(error: AuthErrorLike | null | undefined, email: string, online = true): AuthMessage {
    if (error?.code === 'user_already_exists' || error?.code === 'email_exists') return emailTakenMessage(email)
    if (error?.name === 'AuthWeakPasswordError' || error?.code === 'weak_password') {
        const reason = error.reasons?.map((r) => WEAK_REASONS[r]).find(Boolean)
        return { tone: 'error', icon: 'alert', text: 'La contraseña no vale.', sub: reason, fields: ['password'] }
    }
    if (error?.code === 'email_address_invalid' || error?.code === 'validation_failed') {
        return { tone: 'error', icon: 'alert', text: 'Ese email no es válido.', fields: ['email'] }
    }
    if (!online || isNetworkError(error)) return OFFLINE_MESSAGE
    if (isRateLimited(error)) return RATE_LIMIT_MESSAGE
    return GENERIC_SIGN_UP_MESSAGE
}

/** Cuenta creada (la confirmación por email está desactivada: se entra directo). Sin género. */
export function signUpWelcomeMessage(username: string): AuthMessage {
    const name = username.trim()
    return { tone: 'ok', icon: 'check', text: name ? `Ya estás dentro, ${name}.` : 'Ya estás dentro.', sub: 'Abriendo tu Inicio para conectar Steam…' }
}

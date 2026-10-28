/**
 * Reglas de la cuenta que comparten el registro y el perfil: nombre de usuario, contraseña y formato del email.
 * Son las mismas que exige el servidor (Supabase: contraseña de al menos 6) o las del proyecto (nombre de al menos 3 y libre).
 */

export const USERNAME_MIN = 3
export const PASSWORD_MIN = 6

/**
 * Qué impide preguntar si un nombre está libre: vacío, igual que el actual (perfil) o demasiado corto.
 * `null`: se puede comprobar con `hubgames_username_available`.
 */
export function usernameIssue(value: string, current = ''): 'empty' | 'same' | 'short' | null {
    const v = value.trim()
    if (current.trim() && v === current.trim()) return 'same'
    if (!v) return 'empty'
    if (v.length < USERNAME_MIN) return 'short'
    return null
}

/** Reglas de la contraseña nueva que se marcan mientras escribes. `eq` es null mientras no hay confirmación que comparar. */
export function passwordRules(password: string, confirm: string): { len: boolean; eq: boolean | null } {
    return { len: password.length >= PASSWORD_MIN, eq: confirm ? password === confirm : null }
}

/** «No coinciden» solo cuando ya has escrito tanto como la contraseña (no a la primera letra). */
export function passwordMismatch(password: string, confirm: string): boolean {
    return passwordRules(password, confirm).eq === false && confirm.length >= password.length
}

/** Formato básico de un email (algo@algo.algo, sin espacios). El servidor tiene la última palabra. */
export function emailLooksValid(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

/** Clave compartida: listado JUDI en `/` y Nav al salir de home. */
export const JUDI_HOME_SCROLL_Y_KEY = 'judi_scroll_y'

/** Scroll real en móviles (iOS/WebKit): no fiarse solo de window.scrollY. */
export function getWindowScrollY(): number {
    if (typeof window === 'undefined') return 0
    const se = document.scrollingElement
    if (se) return se.scrollTop
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
}

export function readSavedHomeScrollY(): number {
    if (typeof window === 'undefined') return 0
    const raw = sessionStorage.getItem(JUDI_HOME_SCROLL_Y_KEY)
    if (!raw) return 0
    const y = parseInt(raw, 10)
    return Number.isFinite(y) && y > 0 ? y : 0
}

/**
 * Guardar la Y actual antes de salir de la home (p. ej. enlace del nav).
 * Si no se hace, la transición del router puede llevar el scroll a 0 antes del unmount
 * y sessionStorage queda con 0 en lugar de la posición real.
 */
export function persistJudiHomeScrollYFromWindow(): void {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(JUDI_HOME_SCROLL_Y_KEY, String(getWindowScrollY()))
}

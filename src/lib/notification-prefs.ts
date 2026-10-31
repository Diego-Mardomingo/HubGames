// Tipos de notificación push y preferencias por dispositivo (#90). Sin dependencias del navegador: lo usan también
// scripts/price-alerts.ts y, copiado, la Edge Function send_daily_judi_notifications.

export type NotificationType = 'judi' | 'price'

/** Preferencias de un dispositivo: un tipo que no aparece cuenta como activado (así se añaden tipos sin migrar). */
export type NotificationPrefs = Partial<Record<NotificationType, boolean>>

export const NOTIFICATION_TYPES: { key: NotificationType; label: string; desc: string }[] = [
    { key: 'judi', label: 'JUDI diario', desc: 'Cuando sale el juego del día.' },
    { key: 'price', label: 'Bajadas de precio de la wishlist', desc: 'Cuando un juego cumple su aviso de precio.' },
]

export function wantsType(prefs: unknown, type: NotificationType): boolean {
    if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) return true
    return (prefs as NotificationPrefs)[type] !== false
}

/** «Chrome en Windows», «Safari en iPhone», «Firefox en Android»… a partir del user agent. */
export function deviceNameFromUA(ua: string, standalone = false): string {
    const browser = /Edg\//.test(ua)
        ? 'Edge'
        : /OPR\/|Opera/.test(ua)
          ? 'Opera'
          : /SamsungBrowser\//.test(ua)
            ? 'Samsung Internet'
            : /Firefox\/|FxiOS\//.test(ua)
              ? 'Firefox'
              : /CriOS\/|Chrome\//.test(ua)
                ? 'Chrome'
                : /Safari\//.test(ua)
                  ? 'Safari'
                  : 'Navegador'
    const os = /iPhone/.test(ua)
        ? 'iPhone'
        : /iPad/.test(ua)
          ? 'iPad'
          : /Android/.test(ua)
            ? 'Android'
            : /CrOS/.test(ua)
              ? 'ChromeOS'
              : /Windows/.test(ua)
                ? 'Windows'
                : /Mac OS X|Macintosh/.test(ua)
                  ? 'Mac'
                  : /Linux/.test(ua)
                    ? 'Linux'
                    : null
    const base = os ? `${browser} en ${os}` : browser
    return standalone ? `${base} (app)` : base
}

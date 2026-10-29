/** Rutas de la app que se pueden sugerir en la 404 («¿Querías decir…?»). Las dinámicas y /admin no entran. */
export const APP_ROUTES = [
    { href: '/', label: 'Inicio' },
    { href: '/biblioteca', label: 'Biblioteca' },
    { href: '/biblioteca/bandeja', label: 'Bandeja' },
    { href: '/logros', label: 'Logros' },
    { href: '/logros/historial', label: 'Historial de logros' },
    { href: '/wishlist', label: 'Wishlist' },
    { href: '/estadisticas', label: 'Estadísticas' },
    { href: '/estadisticas/resumen', label: 'Resumen anual' },
    { href: '/judi', label: 'JUDI' },
    { href: '/ranking', label: 'Ranking' },
    { href: '/perfil', label: 'Perfil' },
    { href: '/login', label: 'Iniciar sesión' },
    { href: '/registro', label: 'Crear cuenta' },
] as const

export type AppRoute = (typeof APP_ROUTES)[number]

/** Minúsculas, sin tildes, sin query ni hash y sin barras repetidas o finales. */
export function normalizePath(path: string): string {
    let p = path.split(/[?#]/)[0] ?? ''
    try {
        p = decodeURIComponent(p)
    } catch {
        // Secuencia % mal formada: se compara tal cual
    }
    p = p
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\/{2,}/g, '/')
        .replace(/\/+$/, '')
    return p.startsWith('/') ? p || '/' : `/${p}`
}

/** Distancia de edición (Levenshtein) entre dos cadenas. */
export function editDistance(a: string, b: string): number {
    if (a === b) return 0
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
    for (let i = 1; i <= a.length; i++) {
        const cur = [i]
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
        }
        prev = cur
    }
    return prev[b.length]
}

/**
 * La ruta de la app que probablemente querías al llegar a una que no existe, o `null`.
 * 1. Una errata en la ruta entera (`/bibloteca`, `/estadisticas/resumn`): la más cercana, con un margen de ~30 % de su
 *    longitud (máx. 3 cambios).
 * 2. Si no, la ruta conocida más larga que sea el principio de la pedida (`/biblioteca/xyz` → Biblioteca).
 */
export function closestRoute(path: string): AppRoute | null {
    // Tal cual se pidió: si ya es una ruta de la app no hay nada que sugerir (con mayúsculas o tildes, sí)
    const raw = (path.split(/[?#]/)[0] ?? '').replace(/\/+$/, '') || '/'
    if (APP_ROUTES.some((r) => r.href === raw)) return null
    const p = normalizePath(path)
    if (p === '/') return null
    const same = APP_ROUTES.find((r) => r.href === p)
    if (same) return same

    let best: AppRoute | null = null
    let bestDist = Infinity
    for (const r of APP_ROUTES) {
        if (r.href === '/') continue
        const d = editDistance(p, r.href)
        const limit = Math.min(3, Math.max(1, Math.floor(r.href.length * 0.3)))
        if (d <= limit && d < bestDist) {
            best = r
            bestDist = d
        }
    }
    if (best) return best

    let prefix: AppRoute | null = null
    for (const r of APP_ROUTES) {
        if (r.href !== '/' && p.startsWith(`${r.href}/`) && (!prefix || r.href.length > prefix.href.length)) prefix = r
    }
    return prefix
}

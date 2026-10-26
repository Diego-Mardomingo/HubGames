/**
 * Iconos de logros: GetSchemaForGame sigue devolviendo URLs del CDN antiguo
 * (`steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/…`), que ya no sirve los iconos de los juegos recientes
 * (404). La misma ruta en `shared.akamai.steamstatic.com/community_assets/images/apps/…` funciona para todos.
 * Se aplica al sincronizar y al pintar, para los iconos ya guardados.
 */
const LEGACY_ICON_RE =
    /^https?:\/\/(?:steamcdn-a\.akamaihd\.net|cdn\.(?:akamai|cloudflare)\.steamstatic\.com|media\.steampowered\.com)\/steamcommunity\/public\/images\/apps\//

const ICON_BASE = 'https://shared.akamai.steamstatic.com/community_assets/images/apps/'

export function achievementIconUrl(url: string | null | undefined): string | null {
    if (!url) return null
    return url.replace(LEGACY_ICON_RE, ICON_BASE)
}

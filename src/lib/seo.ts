// SEO (#107): URL pública del sitio, textos comunes y el `robots` de las páginas que necesitan sesión.
import type { Metadata } from 'next'

/**
 * URL pública del sitio, sin barra final. NEXT_PUBLIC_SITE_URL si está; si no, el dominio de producción de Vercel
 * (variable de sistema, también en los previews) y, en local, localhost.
 */
export const SITE_URL = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')
).replace(/\/+$/, '')

export const SITE_NAME = 'HubGames'
export const SITE_TITLE = 'HubGames — Tu biblioteca de Steam y tus logros'
export const SITE_DESCRIPTION =
    'Sigue tu biblioteca de Steam, tus logros por rareza y a qué jugar hoy. Y cada día, JUDI: adivina el videojuego del día.'
export const SITE_SHARE_DESCRIPTION = 'Lo que juegas, lo que te falta y a qué jugar hoy. Y cada día, JUDI: adivina el juego.'

/** Para páginas que sin sesión no enseñan nada útil: fuera del buscador, pero se siguen los enlaces. */
export const PRIVATE_ROBOTS: Metadata['robots'] = { index: false, follow: true }

/** JSON-LD listo para `dangerouslySetInnerHTML`: `<` escapado para que no pueda cerrar el `<script>`. */
export function jsonLd(data: Record<string, unknown>): string {
    return JSON.stringify({ '@context': 'https://schema.org', ...data }).replace(/</g, '\\u003c')
}

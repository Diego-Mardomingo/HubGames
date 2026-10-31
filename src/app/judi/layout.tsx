import type { Metadata } from 'next'
import { isJudiMaintenance } from '@/lib/judi-maintenance'
import { SITE_NAME } from '@/lib/seo'

const TITLE = 'JUDI - Juego del Día'
const DESCRIPTION = 'Adivina el videojuego del día con 6 pistas. ¿Podrás superarlo?'
/** Imagen fija de HubGames: nunca la portada del juego de hoy, que lo desvelaría. */
const IMAGE = { url: '/img/og-hubgames.png', width: 1200, height: 630, alt: 'JUDI: adivina el videojuego del día en HubGames' }

export async function generateMetadata(): Promise<Metadata> {
    if (isJudiMaintenance()) {
        return {
            title: 'JUDI — Mantenimiento',
            description: 'El Juego del día está en mantenimiento. Volvemos pronto.',
        }
    }
    return {
        title: TITLE,
        description: DESCRIPTION,
        alternates: { canonical: '/judi' },
        // openGraph y twitter sustituyen enteros a los del layout raíz: van completos.
        openGraph: { type: 'website', locale: 'es_ES', siteName: SITE_NAME, url: '/judi', title: TITLE, description: DESCRIPTION, images: [IMAGE] },
        twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [IMAGE.url] },
    }
}

export default function JUDILayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}

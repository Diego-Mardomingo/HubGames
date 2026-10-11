import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono, Sora } from 'next/font/google'
import '@/styles/globals.css'
import '@/styles/nav.css'
import Nav from '@/components/Nav'
import Providers from '@/components/Providers'
import SiteFooter from '@/components/SiteFooter'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const sora = Sora({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-sora', display: 'swap' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-jetbrains', display: 'swap' })

export const viewport: Viewport = {
    themeColor: '#07070c',
    width: 'device-width',
    initialScale: 1,
}

export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    title: {
        default: 'HubGames - JUDI',
        template: '%s | HubGames'
    },
    description: 'Adivina el videojuego del día con JUDI y compite por puntos en el ranking global.',
    keywords: ['hubgames', 'hub games', 'videojuegos', 'judi', 'juego del día', 'ranking', 'leaderboard'],
    authors: [{ name: 'Diego López Mardomingo' }],
    creator: 'Diego López Mardomingo',
    manifest: '/manifest.json',
    icons: {
        icon: [
            { url: '/icons/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
            { url: '/icons/favicon.ico', sizes: 'any' },
            { url: '/icons/favicon.svg', type: 'image/svg+xml' },
        ],
        apple: [
            { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
    },
    openGraph: {
        type: 'website',
        locale: 'es_ES',
        url: 'https://hub-games.vercel.app/',
        siteName: 'HubGames',
        title: 'HubGames - JUDI',
        description: 'Juego diario, pistas y ranking global por puntos.',
        images: [
            {
                url: '/img/og-hubgames.png',
                width: 1200,
                height: 630,
                alt: 'HubGames Logo',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'HubGames - JUDI',
        description: 'Adivina el videojuego del día y sube en el ranking.',
        images: ['/img/og-hubgames.png'],
    },
    robots: {
        index: true,
        follow: true,
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="es" className={`${inter.variable} ${sora.variable} ${jetbrains.variable}`}>
            <body className="antialiased">
                <div className="app-bg" aria-hidden>
                    <div className="app-bg__blob app-bg__blob--a" />
                    <div className="app-bg__blob app-bg__blob--b" />
                    <div className="app-bg__blob app-bg__blob--c" />
                    <div className="app-bg__grid" />
                    <div className="app-bg__noise" />
                </div>
                <ServiceWorkerRegistration />
                <Providers>
                    <Nav />
                    <main id="main-content">
                        {children}
                    </main>
                    <SiteFooter />
                </Providers>
            </body>
        </html>
    )
}

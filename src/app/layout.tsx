import type { Metadata, Viewport } from 'next'
import { Onest } from 'next/font/google'
import '@/styles/globals.css'
import '@/styles/nav.css'
import '@/styles/lists.css'
import '@/styles/ui.css'
import Nav from '@/components/Nav'
import Providers from '@/components/Providers'
import SiteFooter from '@/components/SiteFooter'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import { themeScript } from '@/lib/theme'
import { sidebarScript } from '@/lib/sidebar'
import { SITE_DESCRIPTION, SITE_NAME, SITE_SHARE_DESCRIPTION, SITE_TITLE, SITE_URL } from '@/lib/seo'

const onest = Onest({ subsets: ['latin'], variable: '--font-onest', display: 'swap' })

export const viewport: Viewport = {
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#eef0f3' },
        { media: '(prefers-color-scheme: dark)', color: '#15171c' },
    ],
    width: 'device-width',
    initialScale: 1,
}

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: SITE_TITLE,
        template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    keywords: ['hubgames', 'hub games', 'steam', 'biblioteca de steam', 'logros', 'tracker de juegos', 'videojuegos', 'judi', 'juego del día'],
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
        siteName: SITE_NAME,
        title: SITE_TITLE,
        description: SITE_SHARE_DESCRIPTION,
        images: [
            {
                url: '/img/og-hubgames.png',
                width: 1200,
                height: 630,
                alt: 'HubGames: tu biblioteca de Steam y tus logros, en orden',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: SITE_TITLE,
        description: SITE_SHARE_DESCRIPTION,
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
        <html lang="es" className={onest.variable} suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeScript }} />
                <script dangerouslySetInnerHTML={{ __html: sidebarScript }} />
            </head>
            <body className="antialiased">
                <ServiceWorkerRegistration />
                <Providers>
                    <Nav />
                    <div className="app-main">
                        <main id="main-content">
                            {children}
                        </main>
                        <SiteFooter />
                    </div>
                </Providers>
            </body>
        </html>
    )
}

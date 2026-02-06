import type { Metadata, Viewport } from 'next'
import '@/styles/globals.css'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const viewport: Viewport = {
    themeColor: '#00171F',
    width: 'device-width',
    initialScale: 1,
}

export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    title: {
        default: 'HubGames - Buscador de Videojuegos',
        template: '%s | HubGames'
    },
    description: 'Encuentra, sigue y comparte tu pasión por los videojuegos. El mejor buscador integrado con la API de RAWG.',
    keywords: ['hubgames', 'hub games', 'videojuegos', 'juegos', 'buscador', 'judi', 'juego del día'],
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
        title: 'HubGames - Tu Biblioteca Gamer',
        description: 'La plataforma definitiva para gestionar tu colección y descubrir nuevos mundos.',
        images: [
            {
                url: '/img/HGLogo.webp',
                width: 1200,
                height: 630,
                alt: 'HubGames Logo',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'HubGames - Tu Biblioteca Gamer',
        description: 'Encuentra los mejores videojuegos en nuestro buscador.',
        images: ['/img/HGLogo.webp'],
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
        <html lang="es">
            <head>
                <script src="https://kit.fontawesome.com/ed0e2390af.js" crossOrigin="anonymous" async></script>
            </head>
            <body className="antialiased">
                <Nav />
                <main id="main-content">
                    {children}
                </main>
                <Footer />
            </body>
        </html>
    )
}

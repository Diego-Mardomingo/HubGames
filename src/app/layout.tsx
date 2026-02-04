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
    title: 'HubGames - Buscador de Videojuegos',
    description: 'Encuentra los mejores videojuegos en nuestro buscador',
    keywords: ['hubgames', 'hub games', 'videojuegos', 'juegos', 'buscador', 'entretenimiento'],
    authors: [{ name: 'Diego López Mardomingo' }],
    manifest: '/manifest.json',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="es">
            <head>
                <link rel="icon" href="/img/HGLogo.webp" />
                <script src="https://kit.fontawesome.com/ed0e2390af.js" crossOrigin="anonymous" async></script>
            </head>
            <body>
                <Nav />
                {children}
                <Footer />
            </body>
        </html>
    )
}

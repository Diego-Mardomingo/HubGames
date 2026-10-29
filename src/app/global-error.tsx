'use client'

import { useLayoutEffect } from 'react'
import { Onest } from 'next/font/google'
import '@/styles/globals.css'
import '@/styles/lists.css'
import { Logo } from '@/components/brand/Logo'
import ErrorView from '@/components/ErrorView'
import { getThemePref } from '@/lib/theme'

const onest = Onest({ subsets: ['latin'], variable: '--font-onest', display: 'swap' })

/**
 * Fallo del propio layout raíz (barra lateral, proveedores): sustituye al documento entero, así que trae su `<html>`, sus
 * estilos, la fuente y el tema. Sin barra lateral; la marca arriba y la misma tarjeta que `error.tsx`.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
    // El tema se aplica antes de pintar (un <script> en <head> no se ejecutaría al pintarse en el cliente)
    useLayoutEffect(() => {
        const pref = getThemePref()
        const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
        document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }, [])

    return (
        <html lang="es" className={onest.variable} suppressHydrationWarning>
            <head>
                <title>Algo ha fallado | HubGames</title>
            </head>
            <body className="antialiased">
                <main className="hg-status-global">
                    <Logo size={24} animated={false} />
                    <ErrorView error={error} retry={retry} global />
                </main>
            </body>
        </html>
    )
}

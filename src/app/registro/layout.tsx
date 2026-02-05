import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Crear cuenta',
    description: 'Regístrate en HubGames para unirte a la mejor comunidad de videojuegos.',
}

export default function RegistroLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}

import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Crear cuenta',
    description: 'Crea tu cuenta de HubGames y sigue tu biblioteca de Steam, tus logros y el juego del día.',
}

export default function RegistroLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}

import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Iniciar sesión',
    description: 'Entra en HubGames para ver tu biblioteca de Steam, tus logros y tu progreso en JUDI.',
}

export default function LoginLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}

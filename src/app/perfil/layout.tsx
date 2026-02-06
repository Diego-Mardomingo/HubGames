import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Mi Perfil',
    description: 'Gestiona tu cuenta de HubGames, edita tu información personal y cambia tu contraseña.',
}

export default function PerfilLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}

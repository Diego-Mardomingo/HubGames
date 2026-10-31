import type { Metadata } from 'next'
import { PRIVATE_ROBOTS } from '@/lib/seo'

export const metadata: Metadata = {
    title: 'Mi Perfil',
    description: 'Gestiona tu cuenta de HubGames, edita tu información personal y cambia tu contraseña.',
    robots: PRIVATE_ROBOTS,
}

export default function PerfilLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}

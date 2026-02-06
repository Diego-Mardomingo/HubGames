import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Iniciar sesión',
    description: 'Accede a tu cuenta de HubGames para guardar tu progreso en JUDI.',
}

export default function LoginLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}

import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Biblioteca',
    description: 'Clasifica tus juegos de Steam: pendientes, jugando, completados y descartados.',
}

export default function BibliotecaLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}

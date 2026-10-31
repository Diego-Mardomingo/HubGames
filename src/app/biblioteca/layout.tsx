import type { Metadata } from 'next'
import { PRIVATE_ROBOTS } from '@/lib/seo'

export const metadata: Metadata = {
    title: 'Biblioteca',
    description: 'Clasifica tus juegos de Steam: pendientes, jugando, completados y descartados.',
    robots: PRIVATE_ROBOTS,
}

export default function BibliotecaLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}

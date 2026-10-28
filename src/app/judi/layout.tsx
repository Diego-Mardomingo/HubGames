import type { Metadata } from 'next'
import { isJudiMaintenance } from '@/lib/judi-maintenance'

export async function generateMetadata(): Promise<Metadata> {
    if (isJudiMaintenance()) {
        return {
            title: 'JUDI — Mantenimiento',
            description: 'El Juego del día está en mantenimiento. Volvemos pronto.',
        }
    }
    return {
        title: 'JUDI - Juego del Día',
        description: 'Adivina el videojuego del día con 6 pistas. ¿Podrás superarlo?',
    }
}

export default function JUDILayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}

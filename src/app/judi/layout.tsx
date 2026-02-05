import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'JUDI - Juego del Día',
    description: 'Adivina el videojuego del día con 6 pistas. ¿Podrás superarlo?',
}

export default function JUDILayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}

import type { Metadata } from 'next'
import { PRIVATE_ROBOTS } from '@/lib/seo'

// El ranking solo se ve con sesión (sin ella sale un aviso para entrar): fuera del buscador (#107).
export const metadata: Metadata = {
    title: 'Ranking de JUDI',
    description: 'Clasificación de JUDI: cuanto antes aciertes el juego del día, más puntos sumas.',
    robots: PRIVATE_ROBOTS,
}

export default function RankingLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}

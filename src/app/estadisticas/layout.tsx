import type { Metadata } from 'next'
import { PRIVATE_ROBOTS } from '@/lib/seo'

// Estadísticas y resumen del año: necesitan sesión, así que fuera del buscador (#107).
export const metadata: Metadata = { robots: PRIVATE_ROBOTS }

export default function EstadisticasLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}

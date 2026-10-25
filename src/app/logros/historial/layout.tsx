import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Historial de logros',
    description: 'Línea temporal de desbloqueos, heatmap anual y rachas de días con logros.',
}

export default function HistorialLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}

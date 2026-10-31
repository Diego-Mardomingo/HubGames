import { Skeleton, SkeletonZone } from '@/components/ui/skeleton'
import '@/styles/lists.css'
import './stats.css'

/** Primera carga de /estadisticas: esqueleto con la forma de la página (al cambiar de año no hace falta: ya está todo). */
export default function Loading() {
    return (
        <SkeletonZone label="Cargando las estadísticas">
            <div className="stats">
                <header className="page-head">
                    <div>
                        <div className="page-title">
                            <Skeleton shape="text" w="12ch" />
                        </div>
                        <p className="page-subtitle">
                            <Skeleton shape="text" w="36ch" />
                        </p>
                    </div>
                    <Skeleton w={190} h={40} style={{ borderRadius: 'var(--radius-sm)' }} />
                </header>
                <div className="hg-tiles st-tiles" aria-hidden>
                    {Array.from({ length: 5 }, (_, i) => (
                        <Skeleton key={i} h={98} style={{ borderRadius: 12 }} />
                    ))}
                </div>
                <div className="st-grid" aria-hidden>
                    <Skeleton className="st-panel--wide" h={280} style={{ borderRadius: 'var(--radius-lg)' }} />
                    <Skeleton h={280} style={{ borderRadius: 'var(--radius-lg)' }} />
                    <Skeleton h={280} style={{ borderRadius: 'var(--radius-lg)' }} />
                </div>
            </div>
        </SkeletonZone>
    )
}

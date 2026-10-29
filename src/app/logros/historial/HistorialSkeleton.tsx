import { ArrowLeft } from 'lucide-react'
import { Skeleton, SkeletonZone } from '@/components/ui/skeleton'
import { HeatmapSkeleton, TileSkeleton } from '@/components/skeletons'
import '@/styles/lists.css'
import '@/components/achievements/achievements.css'
import '@/components/dashboard/dashboard.css'
import './historial.css'

/** Esqueleto del historial de logros: cabecera, cuatro tiles, el mapa del año y los primeros meses. */
export default function HistorialSkeleton() {
    const year = new Date().getFullYear()
    return (
        <SkeletonZone label="Cargando el historial">
            <div className="logros hi">
                <header className="page-head">
                    <div>
                        <span className="logros__back">
                            <ArrowLeft size={14} aria-hidden /> Logros
                        </span>
                        <h1 className="page-title">Historial</h1>
                        <p className="page-subtitle">
                            <Skeleton shape="text" w="30ch" />
                        </p>
                    </div>
                </header>
                <dl className="hg-tiles lg-tiles hi-tiles">
                    <TileSkeleton label={`Logros en ${year}`} />
                    <TileSkeleton label="Racha actual" />
                    <TileSkeleton label="Mejor racha" />
                    <TileSkeleton label={`El más raro de ${year}`} />
                </dl>
                <section className="heat glass hi-heat">
                    <div className="hi-heat__head">
                        <header className="lg-sec__head">
                            <Skeleton className="lg-sec__icon" />
                            <h2 className="lg-sec__title">Desbloqueos por día</h2>
                        </header>
                        <Skeleton w={96} h={36} style={{ borderRadius: 'var(--radius-sm)' }} />
                    </div>
                    <HeatmapSkeleton />
                </section>
                <section className="hi-tl" aria-hidden>
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} h={i === 0 ? 220 : 76} style={{ borderRadius: 'var(--radius-lg)' }} />
                    ))}
                </section>
            </div>
        </SkeletonZone>
    )
}

import { Skeleton, SkeletonZone } from '@/components/ui/skeleton'
import { HeatmapSkeleton, TileSkeleton } from '@/components/skeletons'
import '@/styles/lists.css'
import '@/components/dashboard/dashboard.css'
import './judi.css'

/** Esqueleto de la portada de JUDI: cabecera de verdad (es fija), tarjeta de hoy, tus cifras y el historial con su mapa. */
export default function JudiSkeleton() {
    return (
        <SkeletonZone label="Cargando JUDI">
            <div className="jd">
                <header className="page-head jd-head">
                    <div>
                        <h1 className="page-title">JUDI</h1>
                        <p className="page-subtitle">
                            Adivina el videojuego del día con 6 capturas y 5 pistas. Cuanto antes aciertes, más puntos sumas en el ranking.
                        </p>
                    </div>
                </header>
                <section className="jd-today" aria-hidden>
                    <Skeleton style={{ aspectRatio: '16 / 9', borderRadius: 0 }} />
                    <div className="jd-today__body">
                        <Skeleton shape="text" w="22ch" />
                        <Skeleton shape="text" w="12ch" style={{ fontSize: '1.5rem' }} />
                        <Skeleton shape="text" w="30ch" />
                        <Skeleton w={170} h={44} style={{ borderRadius: 'var(--radius-sm)' }} />
                    </div>
                </section>
                <div className="jd-stats">
                    <dl className="hg-tiles jd-tiles">
                        <TileSkeleton label="Racha actual" />
                        <TileSkeleton label="Mejor racha" />
                        <TileSkeleton label="Acertados" />
                        <TileSkeleton label="De acierto" />
                        <TileSkeleton label="Media de intentos" />
                        <TileSkeleton label="Puntos" />
                    </dl>
                    <section className="jd-dist glass" aria-hidden>
                        <header className="dash-sec__head">
                            <Skeleton className="dash-sec__icon" />
                            <h2 className="dash-sec__title">En qué intento aciertas</h2>
                        </header>
                        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                            <Skeleton key={i} h={18} style={{ borderRadius: 999, width: `${[80, 64, 46, 30, 20, 12, 36][i]}%` }} />
                        ))}
                    </section>
                </div>
                <section className="jd-history" aria-hidden>
                    <div className="jd-history__head">
                        <header className="dash-sec__head">
                            <Skeleton className="dash-sec__icon" />
                            <h2 className="dash-sec__title">Historial</h2>
                        </header>
                    </div>
                    <div className="jd-heat-wrap glass">
                        <HeatmapSkeleton />
                    </div>
                </section>
            </div>
        </SkeletonZone>
    )
}

import { Skeleton, SkeletonZone } from '@/components/ui/skeleton'
import { AchievementSkeleton, HeatmapSkeleton, RowSkeleton, SectionHeadSkeleton, TileSkeleton } from '@/components/skeletons'
import './dashboard.css'

/** Esqueleto del Inicio (`app/loading.tsx`): saludo, atajos de listas, mapa con sus tiles, «En curso» y «Logros recientes». */
export default function HomeSkeleton() {
    return (
        <SkeletonZone label="Cargando el inicio">
            <div className="dash">
                <header className="dash-head">
                    <div className="dash-head__row">
                        <div>
                            <div className="page-title">
                                <Skeleton shape="text" w="8ch" />
                            </div>
                            <p className="dash-status">
                                <Skeleton shape="text" w="26ch" />
                            </p>
                        </div>
                        <Skeleton w={176} h={40} style={{ borderRadius: 'var(--radius-sm)' }} />
                    </div>
                    <div className="dash-lists">
                        {[8, 9, 10, 11, 7].map((w, i) => (
                            <span key={i} className="dash-list">
                                <Skeleton className="dash-list__icon" />
                                <Skeleton shape="text" w={`${w}ch`} />
                            </span>
                        ))}
                    </div>
                </header>

                <section className="heat glass">
                    <dl className="hg-tiles dash-tiles">
                        <TileSkeleton label="Horas este año" />
                        <TileSkeleton label="Logros este año" />
                        <TileSkeleton label="Completados" />
                        <TileSkeleton label="Tu nota media" />
                    </dl>
                    <HeatmapSkeleton />
                </section>

                <div className="dash-cols">
                    <section className="dash-sec">
                        <SectionHeadSkeleton title="En curso" />
                        <ul className="hg-rows">
                            {[0, 1, 2].map((i) => (
                                <RowSkeleton key={i} i={i} />
                            ))}
                        </ul>
                    </section>
                    <section className="dash-sec">
                        <SectionHeadSkeleton title="Logros recientes" />
                        <ul className="hg-achs">
                            {[0, 1, 2, 3].map((i) => (
                                <AchievementSkeleton key={i} i={i} />
                            ))}
                        </ul>
                    </section>
                </div>
            </div>
        </SkeletonZone>
    )
}

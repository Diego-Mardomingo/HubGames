import { Skeleton, SkeletonZone } from '@/components/ui/skeleton'
import './dashboard.css'
import './home.css'

/** Esqueleto del Inicio (`app/loading.tsx`): saludo con tu semana, la franja de listas, «Continuar jugando» y Pendientes. */
export default function HomeSkeleton() {
    return (
        <SkeletonZone label="Cargando el inicio">
            <div className="home">
                <header className="home-top">
                    <div className="home-top__row">
                        <div>
                            <div className="home-hello">
                                <Skeleton shape="text" w="14ch" />
                            </div>
                            <p className="home-sub">
                                <Skeleton shape="text" w="30ch" />
                            </p>
                        </div>
                        <ol className="home-week" aria-hidden>
                            {Array.from({ length: 7 }, (_, i) => (
                                <li key={i}>
                                    <Skeleton shape="text" w="2ch" />
                                    <Skeleton className="home-week__tile" />
                                    <Skeleton shape="text" w="3ch" />
                                </li>
                            ))}
                        </ol>
                    </div>
                    <div className="home-lib">
                        <ul className="home-lib__bar">
                            {[2, 11, 4, 8, 17].map((n, i) => (
                                <li key={i} style={{ '--n': n } as React.CSSProperties}>
                                    <Skeleton className="home-lib__seg" />
                                </li>
                            ))}
                        </ul>
                    </div>
                </header>
                <section>
                    <div className="home-head">
                        <h2 className="home-head__title">Continuar jugando</h2>
                    </div>
                    <div className="home-playing">
                        {[0, 1, 2].map((i) => (
                            <Skeleton key={i} className="home-play" />
                        ))}
                    </div>
                </section>
                <section>
                    <div className="home-head">
                        <h2 className="home-head__title">Pendientes</h2>
                    </div>
                    <div className="home-rail home-queue">
                        {Array.from({ length: 8 }, (_, i) => (
                            <span key={i} className="home-poster">
                                <Skeleton className="home-poster__art" />
                                <Skeleton shape="text" w="10ch" />
                            </span>
                        ))}
                    </div>
                </section>
            </div>
        </SkeletonZone>
    )
}

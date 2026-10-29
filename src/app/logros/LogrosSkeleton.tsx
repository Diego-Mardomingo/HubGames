import { Skeleton, SkeletonZone } from '@/components/ui/skeleton'
import { RowSkeleton, TileSkeleton } from '@/components/skeletons'
import '@/styles/lists.css'
import '@/components/achievements/achievements.css'

function PanelHead({ title, sm = false }: { title: string; sm?: boolean }) {
    return (
        <header className="lg-sec__head">
            <Skeleton className="lg-sec__icon" />
            <h2 className={`lg-sec__title${sm ? ' lg-sec__title--sm' : ''}`}>{title}</h2>
        </header>
    )
}

/** Esqueleto de /logros: cabecera, cuatro tiles, puntuación de cazador, hitos y las dos primeras secciones. */
export default function LogrosSkeleton() {
    return (
        <SkeletonZone label="Cargando tus logros">
            <div className="logros">
                <header className="page-head">
                    <div>
                        <h1 className="page-title">Logros</h1>
                        <p className="page-subtitle">
                            <Skeleton shape="text" w="40ch" />
                        </p>
                    </div>
                    <Skeleton w={140} h={40} style={{ borderRadius: 'var(--radius-sm)' }} />
                </header>
                <dl className="hg-tiles lg-tiles">
                    <TileSkeleton label="Puntos de cazador" />
                    <TileSkeleton label="Logros" />
                    <TileSkeleton label="Juegos al 100 %" />
                    <TileSkeleton label="Tu logro más raro" />
                </dl>
                <div className="lg-hunt">
                    <div className="lg-hunt__col">
                        <section className="lg-panel">
                            <PanelHead title="Puntuación de cazador" />
                            <p className="lg-score__formula">
                                <Skeleton shape="text" w="34ch" />
                            </p>
                            <Skeleton h={12} style={{ marginTop: '1rem', borderRadius: 999 }} />
                            <ul className="lg-rar-table" aria-hidden>
                                {[0, 1, 2, 3, 4].map((i) => (
                                    <li key={i}>
                                        <Skeleton h={84} style={{ borderRadius: 10 }} />
                                    </li>
                                ))}
                            </ul>
                        </section>
                        <section className="lg-panel">
                            <PanelHead title="Juegos con más puntos" sm />
                            <ol className="lg-top" aria-hidden style={{ marginTop: '0.75rem' }}>
                                {[0, 1, 2, 3, 4].map((i) => (
                                    <li key={i} className="lg-top__game">
                                        <Skeleton shape="text" w="1ch" />
                                        <Skeleton w={64} h={30} />
                                        <Skeleton shape="text" w={`${[70, 55, 62, 48, 58][i]}%`} />
                                        <Skeleton shape="text" w="5ch" />
                                    </li>
                                ))}
                            </ol>
                        </section>
                    </div>
                    <section className="lg-panel">
                        <PanelHead title="Hitos" />
                        <div style={{ display: 'grid', gap: '1.25rem', marginTop: '1rem' }} aria-hidden>
                            {[0, 1, 2].map((i) => (
                                <div key={i} style={{ display: 'grid', gap: 10 }}>
                                    <Skeleton shape="text" w="14ch" />
                                    <Skeleton h={34} style={{ borderRadius: 999 }} />
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
                <div className="hunt-grid">
                    {['Cerca del 100 %', 'Logros fáciles que te faltan'].map((title) => (
                        <section key={title} className="lg-sec">
                            <PanelHead title={title} />
                            <ul className="hg-rows game-lines">
                                {[0, 1, 2].map((i) => (
                                    <RowSkeleton key={i} i={i + (title.length % 3)} end={false} />
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>
        </SkeletonZone>
    )
}

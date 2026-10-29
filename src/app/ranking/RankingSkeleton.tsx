import { Skeleton, SkeletonZone } from '@/components/ui/skeleton'
import { TileSkeleton } from '@/components/skeletons'
import '@/styles/lists.css'
import './ranking.css'

/** Alturas del podio (tarjeta + pedestal) en el orden en que se ve: 2.º, 1.º y 3.º. */
const PODIUM = [
    { card: 150, step: 64 },
    { card: 150, step: 96 },
    { card: 150, step: 40 },
]

/** Esqueleto del ranking: la cabecera de verdad (es fija), cuatro tiles, el podio y las primeras filas. */
export default function RankingSkeleton() {
    return (
        <SkeletonZone label="Cargando el ranking">
            <div className="rk">
                <header className="page-head rk-head">
                    <div>
                        <h1 className="page-title">Ranking</h1>
                        <p className="page-subtitle">Cuanto antes aciertes el juego del día, más puntos sumas.</p>
                        <p className="rk-rules">
                            <span>Puntos por intento</span>
                            <span className="rk-rules__pts" aria-hidden>
                                {[6, 5, 4, 3, 2, 1].map((p) => (
                                    <span key={p}>+{p}</span>
                                ))}
                            </span>
                            <span>· fallar no suma</span>
                        </p>
                    </div>
                </header>
                <dl className="hg-tiles rk-tiles">
                    <TileSkeleton label="Tu puesto" />
                    <TileSkeleton label="Puntos" />
                    <TileSkeleton label="Ventaja" />
                    <TileSkeleton label="Acertados" />
                </dl>
                <div className="rk-pd" aria-hidden>
                    {PODIUM.map((p, i) => (
                        <div key={i} style={{ display: 'grid', gap: 2 }}>
                            <Skeleton h={p.card} style={{ borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }} />
                            <Skeleton h={p.step} style={{ borderRadius: '0 0 var(--radius) var(--radius)', opacity: 0.7 }} />
                        </div>
                    ))}
                </div>
                <ul className="rk-list" aria-hidden>
                    {[0, 1, 2, 3].map((i) => (
                        <li key={i}>
                            <Skeleton h={62} style={{ borderRadius: 'var(--radius)' }} />
                        </li>
                    ))}
                </ul>
            </div>
        </SkeletonZone>
    )
}

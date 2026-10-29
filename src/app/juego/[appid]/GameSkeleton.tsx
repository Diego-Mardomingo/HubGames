import { ArrowLeft } from 'lucide-react'
import { Skeleton, SkeletonZone } from '@/components/ui/skeleton'
import { TileSkeleton } from '@/components/skeletons'
import '@/styles/lists.css'
import './juego.css'

/** Panel «Tus datos» mientras se carga tu fila: selector de estado, marcas y los cuatro tiles. */
export function GamePanelSkeleton() {
    return (
        <section className="juego-panel glass" aria-busy="true" aria-label="Cargando tus datos">
            <div className="juego-panel__top">
                <Skeleton className="juego-status" h={80} />
                <div className="juego-marks">
                    <Skeleton w={112} h={42} style={{ borderRadius: 'var(--radius)' }} />
                    <Skeleton w={112} h={42} style={{ borderRadius: 'var(--radius)' }} />
                </div>
            </div>
            <dl className="hg-tiles">
                <TileSkeleton label="Horas" />
                <TileSkeleton label="Última partida" />
                <TileSkeleton label="Tu nota" />
                <TileSkeleton label="Logros" />
            </dl>
        </section>
    )
}

/** Esqueleto de la ficha (`loading.tsx`): imagen grande, título, datos en pastillas y el panel. */
export default function GameSkeleton() {
    return (
        <SkeletonZone label="Cargando el juego">
            <div className="juego">
                <span className="juego__back">
                    <ArrowLeft size={14} aria-hidden /> Biblioteca
                </span>
                <header className="juego__head">
                    <Skeleton className="juego__hero" style={{ borderRadius: 'var(--radius-lg)' }} />
                    <div className="juego__heading">
                        <div className="juego__title-row">
                            <div className="juego__title">
                                <h1 className="page-title">
                                    <Skeleton shape="text" w="12ch" />
                                </h1>
                                <p className="juego__studios">
                                    <Skeleton shape="text" w="18ch" />
                                </p>
                            </div>
                            <div className="juego__actions">
                                <Skeleton w={110} h={40} style={{ borderRadius: 'var(--radius-sm)' }} />
                                <Skeleton w={130} h={40} style={{ borderRadius: 'var(--radius-sm)' }} />
                            </div>
                        </div>
                        <ul className="juego__facts" aria-hidden>
                            {[96, 150, 132, 118].map((w, i) => (
                                <li key={i}>
                                    <Skeleton w={w} h={36} style={{ borderRadius: 'var(--radius)' }} />
                                </li>
                            ))}
                        </ul>
                    </div>
                </header>
                <GamePanelSkeleton />
            </div>
        </SkeletonZone>
    )
}

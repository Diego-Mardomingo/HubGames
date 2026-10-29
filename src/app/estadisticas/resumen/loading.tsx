import { ArrowLeft } from 'lucide-react'
import { Skeleton, SkeletonZone } from '@/components/ui/skeleton'
import '@/styles/lists.css'
import './resumen.css'

/**
 * Esqueleto del resumen anual: propio, porque sin él esta ruta hereda el de Estadísticas (tiles y paneles), que no se
 * parece en nada. El año en grande, la frase, las horas y el juego del año.
 */
export default function Loading() {
    return (
        <SkeletonZone label="Cargando tu resumen del año">
            <div className="wr">
                <span className="wr-back">
                    <ArrowLeft aria-hidden /> <Skeleton shape="text" w="16ch" />
                </span>
                <header className="wr-hero">
                    <div>
                        <p className="wr-hero__kicker">
                            <Skeleton shape="text" w="18ch" />
                        </p>
                        <h1 className="wr-hero__year">
                            <Skeleton shape="text" w="4.2ch" />
                        </h1>
                        <p className="wr-hero__lead">
                            <Skeleton shape="text" w="36ch" />
                        </p>
                    </div>
                    <div className="wr-hero__side">
                        <Skeleton w={220} h={36} style={{ borderRadius: 'var(--radius-sm)' }} />
                        <Skeleton w={160} h={40} style={{ borderRadius: 'var(--radius-sm)' }} />
                    </div>
                </header>
                <Skeleton h={300} style={{ borderRadius: 'var(--radius-xl)' }} />
                <Skeleton h={420} style={{ borderRadius: 'var(--radius-xl)' }} />
            </div>
        </SkeletonZone>
    )
}

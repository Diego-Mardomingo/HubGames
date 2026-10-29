import type { CSSProperties } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import '@/styles/lists.css'

/**
 * Piezas de esqueleto con la forma de las compartidas (`.hg-tile`, `.hg-row`, `.hg-ach`, cabecera de sección): cada página
 * monta el suyo con estas y sus propias clases, para que al llegar el contenido no se mueva nada. Los textos fijos
 * (etiquetas de los tiles, títulos de sección) salen tal cual; lo que depende de los datos, como hueso.
 */

/** Tile de cifra: etiqueta real, hueco del icono, cifra y nota (`note={false}` si el de verdad no lleva nota). */
export function TileSkeleton({ label, note = true, className, style }: { label: string; note?: boolean; className?: string; style?: CSSProperties }) {
    return (
        <div className={cn('hg-tile', className)} style={style}>
            <dt>
                <Skeleton className="hg-tile__icon" />
                {label}
            </dt>
            <dd className="hg-tile__value">
                <Skeleton shape="text" w="3ch" />
            </dd>
            {note && (
                <dd className="hg-tile__note">
                    <Skeleton shape="text" w="13ch" />
                </dd>
            )}
        </div>
    )
}

/** Fila con cápsula (`.hg-row`): nombre, línea de datos y, si `end`, la barra de logros a la derecha. */
export function RowSkeleton({ className, end = true, i = 0 }: { className?: string; end?: boolean; i?: number }) {
    const widths = ['58%', '42%', '66%', '50%', '38%', '61%', '46%', '54%']
    return (
        <li className={cn('hg-row', className)} style={{ '--c': 'transparent' } as CSSProperties} aria-hidden>
            <Skeleton className="hg-row__cover" />
            <span className="hg-row__main">
                <span className="lib-row__name">
                    <Skeleton shape="text" w={widths[i % widths.length]} />
                </span>
                <span className="hg-row__meta">
                    <Skeleton shape="text" w="16ch" />
                </span>
            </span>
            {end && (
                <span className="hg-row__prog">
                    <span className="hg-row__prog-label">
                        <Skeleton shape="text" w="10ch" />
                        <Skeleton shape="text" w="4ch" />
                    </span>
                    <Skeleton className="hg-bar" />
                </span>
            )}
        </li>
    )
}

/** Logro (`.hg-ach`): icono, nombre, juego y porcentaje. */
export function AchievementSkeleton({ i = 0 }: { i?: number }) {
    const widths = ['62%', '48%', '70%', '55%', '40%']
    return (
        <li className="hg-ach" aria-hidden>
            <Skeleton className="hg-ach__icon" />
            <span className="hg-row__main">
                <span className="hg-ach__name">
                    <Skeleton shape="text" w={widths[i % widths.length]} />
                </span>
                <span className="hg-row__meta">
                    <Skeleton shape="text" w="12ch" />
                </span>
            </span>
            <Skeleton shape="text" w="5ch" />
        </li>
    )
}

/** Cabecera de sección del Inicio (`.dash-sec__head`, también en perfil, logros, ranking…): título real, icono en hueso. */
export function SectionHeadSkeleton({ title }: { title: string }) {
    return (
        <header className="dash-sec__head">
            <Skeleton className="dash-sec__icon" />
            <h2 className="dash-sec__title">{title}</h2>
        </header>
    )
}

/** Mapa de actividad (`ActivityHeatmap`): un bloque con la proporción de 53 semanas × 7 días y el pie. */
export function HeatmapSkeleton({ weeks = 53 }: { weeks?: number }) {
    return (
        <>
            <Skeleton className="heat-skel" style={{ aspectRatio: `${weeks} / 7.4` }} />
            <div className="heat__foot">
                <Skeleton shape="text" w="16ch" />
            </div>
        </>
    )
}

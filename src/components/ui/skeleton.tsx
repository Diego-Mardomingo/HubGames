import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type SkeletonProps = {
    /**
     * text: hueso de una línea de texto, para meterlo dentro de la etiqueta real (h1, p, span…) y que la altura de línea
     * sea la misma que la del contenido; block: cápsula, imagen, barra, botón (tamaño por className o w/h); circle: avatar.
     */
    shape?: 'text' | 'block' | 'circle'
    /** Ancho (texto: en `ch` o `%`; bloque: cualquier medida CSS). */
    w?: string | number
    /** Alto (bloque y círculo). */
    h?: string | number
    className?: string
    style?: CSSProperties
}

/** Hueso de un esqueleto de carga: gris de --surface-2 con el brillo que lo recorre (`.hg-skel` en lists.css). */
export function Skeleton({ shape = 'block', w, h, className, style }: SkeletonProps) {
    const size: CSSProperties & { '--w'?: string } =
        shape === 'text' ? { '--w': typeof w === 'number' ? `${w}px` : w } : { width: w, height: shape === 'circle' ? (h ?? w) : h }
    return (
        <span
            className={cn('hg-skel', shape === 'text' && 'hg-skel--text', shape === 'circle' && 'hg-skel--circle', className)}
            style={{ ...size, ...style }}
            aria-hidden
        />
    )
}

/**
 * Zona de carga: anuncia «Cargando…» a los lectores de pantalla y aparece con un fundido a partir de 150 ms, para que
 * las cargas rápidas no parpadeen. Envuelve el esqueleto de una página (o de un panel).
 */
export function SkeletonZone({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
    return (
        <div className={cn('hg-skel-zone', className)} role="status" aria-busy="true" aria-label={label}>
            {children}
        </div>
    )
}

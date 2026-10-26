'use client'

import { useState, type ReactNode } from 'react'

type Props = {
    value: number
    /** Texto de la cifra (p. ej. «99+»). Por defecto, el número tal cual. */
    format?: (value: number) => string
    /** Contenido antes de la cifra (un icono). */
    children?: ReactNode
    className?: string
    'aria-label'?: string
    title?: string
}

/**
 * Contador que «salta» al cambiar: la cápsula hace un pop y la cifra entra desde abajo si sube o desde arriba si baja
 * (clases `.hg-count*` en styles/lists.css). Al montar no se anima. `prefers-reduced-motion` lo anula (regla global).
 */
export default function AnimatedCount({ value, format = String, children, className, ...rest }: Props) {
    const [prev, setPrev] = useState(value)
    const [change, setChange] = useState<{ n: number; dir: 'up' | 'down' } | null>(null)

    // Guardar el valor anterior durante el render (patrón de React para reaccionar a un cambio de props).
    if (value !== prev) {
        setPrev(value)
        setChange({ n: (change?.n ?? 0) + 1, dir: value > prev ? 'up' : 'down' })
    }

    return (
        <span key={change?.n ?? 0} className={['hg-count', change && 'hg-count--pop', className].filter(Boolean).join(' ')} {...rest}>
            {children}
            <span className={change ? `hg-count__num hg-count__num--${change.dir}` : 'hg-count__num'}>{format(value)}</span>
        </span>
    )
}

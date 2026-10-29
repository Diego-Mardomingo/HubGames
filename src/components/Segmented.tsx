'use client'

import { useId, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import AnimatedCount from '@/components/AnimatedCount'
import '@/styles/lists.css'

const EASE_OUT = [0.22, 1, 0.36, 1] as const

/**
 * Control segmentado con el fondo activo que se desliza (`layoutId`, 220 ms; `.hg-seg--slide` en styles/lists.css) y,
 * si se pasan, contadores que saltan (`AnimatedCount`). Lo comparten los logros de un juego y la wishlist.
 */
export default function Segmented<T extends string>({
    value,
    options,
    labels,
    onChange,
    counts,
    icons,
    countClassName,
    scroll,
    iconOnly,
    className,
    ...aria
}: {
    value: T
    options: readonly T[]
    labels: Record<T, string>
    onChange: (v: T) => void
    counts?: Record<T, number>
    /** Icono delante de la etiqueta (con su color). */
    icons?: Partial<Record<T, ReactNode>>
    /** Clases extra del contador de cada opción (color, cero apagado). */
    countClassName?: (option: T, count: number) => string
    scroll?: boolean
    /** Solo el icono a la vista (la etiqueta queda para lectores de pantalla y como `title`). */
    iconOnly?: boolean
    className?: string
    'aria-label'?: string
    'aria-labelledby'?: string
}) {
    const id = useId()
    const reduce = useReducedMotion()
    return (
        <div className={['hg-seg hg-seg--slide', scroll && 'hg-seg--scroll', className].filter(Boolean).join(' ')} role="group" {...aria}>
            {options.map((o) => (
                <button
                    key={o}
                    type="button"
                    className={`hg-seg__opt${value === o ? ' is-active' : ''}`}
                    aria-pressed={value === o}
                    title={iconOnly ? labels[o] : undefined}
                    onClick={() => onChange(o)}
                >
                    {value === o && (
                        <motion.span layoutId={`${id}-thumb`} className="hg-seg__thumb" transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT }} />
                    )}
                    {icons?.[o] && <span className="hg-seg__text hg-seg__icon">{icons[o]}</span>}
                    <span className={iconOnly ? 'sr-only' : 'hg-seg__text'}>{labels[o]}</span>
                    {counts && (
                        <AnimatedCount
                            value={counts[o]}
                            className={['hg-seg__count hg-seg__text', countClassName?.(o, counts[o])].filter(Boolean).join(' ')}
                        />
                    )}
                </button>
            ))}
        </div>
    )
}

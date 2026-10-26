'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
    value: number
    /** Decimales (con coma). Por defecto, entero. */
    decimals?: number
    /** Texto tras la cifra («h»), separado por un espacio. */
    suffix?: string
    className?: string
}

const DURATION = 450

function format(n: number, decimals: number, suffix?: string) {
    const text = n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    return suffix ? `${text} ${suffix}` : text
}

function reducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Cifra que cuenta desde 0 al llegar a la página (450 ms, ease-out) y, si luego cambia, «salta» como AnimatedCount
 * (clases `.hg-count*` de styles/lists.css). En el servidor y para lectores de pantalla siempre es el valor final.
 * `prefers-reduced-motion`: sin conteo.
 */
export default function CountUp({ value, decimals = 0, suffix, className }: Props) {
    // Conteo de entrada: null = ya terminó (se enseña el valor real).
    const [counting, setCounting] = useState<number | null>(null)
    const initial = useRef(value)
    // Saltos posteriores (patrón de AnimatedCount: comparar con el valor anterior durante el render).
    const [prev, setPrev] = useState(value)
    const [jump, setJump] = useState<{ n: number; dir: 'up' | 'down' } | null>(null)
    if (value !== prev) {
        setPrev(value)
        setJump({ n: (jump?.n ?? 0) + 1, dir: value > prev ? 'up' : 'down' })
    }

    useEffect(() => {
        const target = initial.current
        if (reducedMotion() || target === 0) return
        const factor = 10 ** decimals
        const start = performance.now()
        let frame = 0
        const tick = (t: number) => {
            const k = Math.min(1, (t - start) / DURATION)
            const eased = 1 - Math.pow(1 - k, 3)
            setCounting(k < 1 ? Math.round(target * eased * factor) / factor : null)
            if (k < 1) frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [decimals])

    const shown = counting ?? value
    return (
        <span key={jump?.n ?? 0} className={['hg-count', jump && 'hg-count--pop', className].filter(Boolean).join(' ')}>
            <span className="sr-only">{format(value, decimals, suffix)}</span>
            <span aria-hidden className={jump ? `hg-count__num hg-count__num--${jump.dir}` : 'hg-count__num'}>
                {format(shown, decimals, suffix)}
            </span>
        </span>
    )
}

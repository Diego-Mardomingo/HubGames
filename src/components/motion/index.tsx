'use client'

import { useEffect, useId, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from 'framer-motion'

/** Número que cuenta desde 0 (o desde el valor previo) al entrar en pantalla. */
export function CountUp({
    value,
    duration = 1.1,
    suffix = '',
    className,
}: {
    value: number
    duration?: number
    suffix?: string
    className?: string
}) {
    const ref = useRef<HTMLSpanElement>(null)
    const inView = useInView(ref, { once: true, margin: '-40px' })
    const reduce = useReducedMotion()
    const fromRef = useRef(0)

    useEffect(() => {
        const el = ref.current
        if (!el || !inView) return
        if (reduce) {
            el.textContent = `${value.toLocaleString('es-ES')}${suffix}`
            fromRef.current = value
            return
        }
        const controls = animate(fromRef.current, value, {
            duration,
            ease: [0.22, 1, 0.36, 1],
            onUpdate: (v) => {
                el.textContent = `${Math.round(v).toLocaleString('es-ES')}${suffix}`
            },
        })
        fromRef.current = value
        return () => controls.stop()
    }, [value, inView, duration, suffix, reduce])

    return (
        <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
            0{suffix}
        </span>
    )
}

/** Cada dígito rueda verticalmente al cambiar (contador estilo marcador). */
export function RollingText({ text, className }: { text: string; className?: string }) {
    return (
        <span className={['rolling', className].filter(Boolean).join(' ')} aria-label={text}>
            {text.split('').map((ch, i) =>
                /\d/.test(ch) ? (
                    <span key={i} className="rolling__slot" aria-hidden>
                        <AnimatePresence initial={false} mode="popLayout">
                            <motion.span
                                key={ch}
                                className="rolling__digit"
                                initial={{ y: '-100%', opacity: 0, filter: 'blur(2px)' }}
                                animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
                                exit={{ y: '100%', opacity: 0, filter: 'blur(2px)' }}
                                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            >
                                {ch}
                            </motion.span>
                        </AnimatePresence>
                    </span>
                ) : (
                    <span key={i} className="rolling__sep" aria-hidden>
                        {ch}
                    </span>
                )
            )}
        </span>
    )
}

/**
 * Inclinación 3D + reflejo que sigue al puntero. Devuelve props para el elemento.
 * Usa variables CSS (--rx, --ry, --mx, --my) para no re-renderizar en cada movimiento.
 */
export function useTilt<T extends HTMLElement>(max = 8) {
    const reduce = useReducedMotion()
    const frame = useRef(0)

    const onPointerMove = (e: PointerEvent<T>) => {
        if (reduce || e.pointerType !== 'mouse') return
        const el = e.currentTarget
        const rect = el.getBoundingClientRect()
        const px = (e.clientX - rect.left) / rect.width
        const py = (e.clientY - rect.top) / rect.height
        cancelAnimationFrame(frame.current)
        frame.current = requestAnimationFrame(() => {
            el.style.setProperty('--rx', `${(0.5 - py) * max}deg`)
            el.style.setProperty('--ry', `${(px - 0.5) * max}deg`)
            el.style.setProperty('--mx', `${px * 100}%`)
            el.style.setProperty('--my', `${py * 100}%`)
        })
    }

    const onPointerLeave = (e: PointerEvent<T>) => {
        cancelAnimationFrame(frame.current)
        const el = e.currentTarget
        el.style.setProperty('--rx', '0deg')
        el.style.setProperty('--ry', '0deg')
    }

    return { onPointerMove, onPointerLeave }
}

/** Aparición al entrar en viewport (fade + subida), con retardo opcional. */
export function Reveal({
    children,
    delay = 0,
    y = 16,
    className,
    style,
}: {
    children: ReactNode
    delay?: number
    y?: number
    className?: string
    style?: CSSProperties
}) {
    return (
        <motion.div
            className={className}
            style={style}
            initial={{ opacity: 0, y }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
        >
            {children}
        </motion.div>
    )
}

/** Anillo de progreso SVG animado (0–100). */
export function ProgressRing({
    value,
    size = 120,
    stroke = 10,
    children,
}: {
    value: number
    size?: number
    stroke?: number
    children?: ReactNode
}) {
    const r = (size - stroke) / 2
    const c = 2 * Math.PI * r
    const pct = Math.min(100, Math.max(0, value))
    const id = `ring-${useId().replace(/:/g, '')}`
    return (
        <div className="progress-ring" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
                <defs>
                    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#b69cff" />
                        <stop offset="1" stopColor="#2ad4f0" />
                    </linearGradient>
                </defs>
                <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" />
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke={`url(#${id})`}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={c}
                    initial={{ strokeDashoffset: c }}
                    animate={{ strokeDashoffset: c - (c * pct) / 100 }}
                    transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                />
            </svg>
            <div className="progress-ring__center">{children}</div>
        </div>
    )
}

'use client'

import { useId } from 'react'
import { motion, type Transition } from 'framer-motion'

/**
 * Monograma HubGames: H y G comparten el trazo central, que se interrumpe en un nodo (el "hub").
 * Del nodo salen cuatro conexiones (arriba, abajo, izquierda, derecha), como una cruceta.
 */
const STROKES = [
    'M13 14V50', // H: pierna izquierda
    'M13 32H21.5', // H: travesaño → nodo
    'M50.5 20.5C48 16.5 44 14 38 14H31V22.5', // G: arco superior → nodo
    'M31 41.5V50H38C45.5 50 50.5 45.5 50.5 39V32H40.5', // G: base + espolón → nodo
] as const

type LogoMarkProps = {
    size?: number
    /** Dibuja los trazos al montar. */
    animated?: boolean
    /** Bucle infinito (para el loader). */
    loop?: boolean
    /** Fondo tipo icono de app (squircle). */
    tile?: boolean
    className?: string
    title?: string
}

const ease: Transition['ease'] = [0.22, 1, 0.36, 1]

export function LogoMark({ size = 32, animated = false, loop = false, tile = false, className, title }: LogoMarkProps) {
    const uid = useId().replace(/:/g, '')
    const gradId = `hg-grad-${uid}`
    const glowId = `hg-glow-${uid}`
    const strokeW = size < 24 ? 7.5 : 6.4

    const drawTransition = (i: number): Transition =>
        loop
            ? { duration: 1.1, ease: 'easeInOut', delay: i * 0.12, repeat: Infinity, repeatType: 'reverse', repeatDelay: 0.25 }
            : { duration: 0.75, ease, delay: 0.1 + i * 0.09 }

    return (
        <svg
            className={['hg-mark', className].filter(Boolean).join(' ')}
            width={size}
            height={size}
            viewBox="0 0 64 64"
            fill="none"
            role={title ? 'img' : undefined}
            aria-label={title}
            aria-hidden={title ? undefined : true}
        >
            <defs>
                <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="10" y1="10" x2="54" y2="54">
                    <stop offset="0" stopColor="#b69cff" />
                    <stop offset="0.55" stopColor="#6f8bff" />
                    <stop offset="1" stopColor="#2ad4f0" />
                </linearGradient>
                <filter id={glowId} x="-150%" y="-150%" width="400%" height="400%">
                    <feGaussianBlur stdDeviation="2.4" result="b" />
                    <feMerge>
                        <feMergeNode in="b" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {tile && <rect x="1" y="1" width="62" height="62" rx="18" fill="#100f1c" stroke={`url(#${gradId})`} strokeOpacity="0.45" strokeWidth="1.5" />}

            <g
                transform={tile ? 'translate(32 32) scale(0.74) translate(-32 -32)' : undefined}
                stroke={`url(#${gradId})`}
                strokeWidth={strokeW}
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                {STROKES.map((d, i) =>
                    animated || loop ? (
                        <motion.path
                            key={d}
                            d={d}
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: 1 }}
                            transition={{ pathLength: drawTransition(i), opacity: { duration: 0.15, delay: loop ? 0 : 0.1 + i * 0.09 } }}
                        />
                    ) : (
                        <path key={d} d={d} />
                    )
                )}

                <circle className="hg-mark__ring" cx="31" cy="32" r="5" stroke="#7fe8ff" strokeWidth="1.6" fill="none" />
                {animated || loop ? (
                    <motion.circle
                        className="hg-mark__node"
                        cx="31"
                        cy="32"
                        r="5.4"
                        fill="#ffffff"
                        stroke="none"
                        filter={`url(#${glowId})`}
                        initial={{ scale: 0 }}
                        animate={loop ? { scale: [0.7, 1.15, 0.7] } : { scale: 1 }}
                        transition={
                            loop
                                ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
                                : { type: 'spring', stiffness: 420, damping: 14, delay: 0.55 }
                        }
                        style={{ transformOrigin: '31px 32px', transformBox: 'view-box' }}
                    />
                ) : (
                    <circle className="hg-mark__node" cx="31" cy="32" r="5.4" fill="#ffffff" stroke="none" filter={`url(#${glowId})`} />
                )}
            </g>
        </svg>
    )
}

export function Wordmark({ className }: { className?: string }) {
    return (
        <span className={['hg-wordmark', className].filter(Boolean).join(' ')}>
            hub<span className="hg-wordmark__accent">games</span>
        </span>
    )
}

export function Logo({ size = 30, animated = true }: { size?: number; animated?: boolean }) {
    return (
        <span className="hg-logo">
            <LogoMark size={size} animated={animated} />
            <Wordmark />
        </span>
    )
}

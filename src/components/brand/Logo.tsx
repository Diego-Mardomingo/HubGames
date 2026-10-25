'use client'

import { motion, type Transition } from 'framer-motion'

/**
 * Marca HubGames: una gema (el logro) enmarcada por el cursor de selección de la interfaz.
 * Los corchetes usan el acento; la gema, el color del texto; la faceta, el dorado de "legendaria".
 */
const BRACKETS = 'M6 20V6h14M44 6h14v14M58 44v14H44M20 58H6V44'
const GEM = 'M32 16.5 45.5 24.25v15.5L32 47.5 18.5 39.75v-15.5z'
const FACET = 'M32 32 45.5 24.25v15.5L32 47.5z'

type LogoMarkProps = {
    size?: number
    /** Los corchetes "se ajustan" sobre la gema al montar. */
    animated?: boolean
    /** Bucle infinito (para el loader). */
    loop?: boolean
    /** Fondo tipo icono de app. */
    tile?: boolean
    className?: string
    title?: string
}

const ease: Transition['ease'] = [0.22, 1, 0.36, 1]
const origin = { transformOrigin: '32px 32px', transformBox: 'view-box' } as const

export function LogoMark({ size = 32, animated = false, loop = false, tile = false, className, title }: LogoMarkProps) {
    const motionOn = animated || loop
    const gem = (
        <>
            <path d={GEM} fill="currentColor" />
            <path d={FACET} fill="var(--rar-leg)" />
        </>
    )

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
            {tile && <rect x="0" y="0" width="64" height="64" rx="14" fill="var(--surface)" />}
            <g transform={tile ? 'translate(32 32) scale(0.78) translate(-32 -32)' : undefined}>
                {motionOn ? (
                    <motion.path
                        className="hg-mark__brackets"
                        d={BRACKETS}
                        stroke="var(--cursor)"
                        strokeWidth={5.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={origin}
                        initial={{ scale: 1.3, opacity: 0 }}
                        animate={loop ? { scale: [1, 0.86, 1], opacity: 1 } : { scale: 1, opacity: 1 }}
                        transition={
                            loop
                                ? { scale: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.2 } }
                                : { duration: 0.5, ease }
                        }
                    />
                ) : (
                    <path
                        className="hg-mark__brackets"
                        d={BRACKETS}
                        stroke="var(--cursor)"
                        strokeWidth={5.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}
                {motionOn ? (
                    <motion.g
                        style={origin}
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.4, ease, delay: 0.1 }}
                    >
                        {gem}
                    </motion.g>
                ) : (
                    gem
                )}
            </g>
        </svg>
    )
}

export function Wordmark({ className }: { className?: string }) {
    return <span className={['hg-wordmark', className].filter(Boolean).join(' ')}>HubGames</span>
}

export function Logo({ size = 30, animated = true }: { size?: number; animated?: boolean }) {
    return (
        <span className="hg-logo">
            <LogoMark size={size} animated={animated} />
            <Wordmark />
        </span>
    )
}

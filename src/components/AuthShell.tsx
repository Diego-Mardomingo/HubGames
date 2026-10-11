'use client'

import { motion } from 'framer-motion'
import { LogoMark, Wordmark } from '@/components/brand/Logo'

const ease = [0.22, 1, 0.36, 1] as const

/** Layout común de login/registro: panel de marca animado + formulario. */
export default function AuthShell({
    title,
    subtitle,
    children,
}: {
    title: string
    subtitle: string
    children: React.ReactNode
}) {
    return (
        <motion.div
            className="auth"
            initial={{ opacity: 0, y: 16, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease }}
        >
            <aside className="auth__brand" aria-hidden>
                <div className="auth__brand-top">
                    <Wordmark />
                </div>
                <span className="auth__orbit" />
                <span className="auth__orbit auth__orbit--inner" />
                <div className="auth__mark">
                    <LogoMark size={120} animated />
                </div>
                <div>
                    <p className="auth__tagline">
                        Un juego.
                        <br />
                        Seis capturas.
                        <br />
                        <span className="text-gradient">Cada día.</span>
                    </p>
                    <p className="auth__tagline-sub">Adivina el videojuego del día y compite con otros jugadores en el ranking.</p>
                </div>
            </aside>
            <div className="auth__form-wrap">
                <div className="auth__form">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease, delay: 0.15 }}
                    >
                        <h1 className="auth__title">{title}</h1>
                        <p className="auth__subtitle">{subtitle}</p>
                    </motion.div>
                    <motion.div
                        style={{ display: 'grid', gap: '1rem' }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease, delay: 0.25 }}
                    >
                        {children}
                    </motion.div>
                </div>
            </div>
        </motion.div>
    )
}

export function FormError({ message }: { message: string }) {
    if (!message) return null
    return (
        <motion.div
            key={message}
            className="alert alert--error"
            role="alert"
            initial={{ opacity: 0, x: 0 }}
            animate={{ opacity: 1, x: [0, -8, 7, -4, 2, 0] }}
            transition={{ duration: 0.45 }}
        >
            {message}
        </motion.div>
    )
}

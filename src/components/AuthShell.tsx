'use client'

import type { CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'

/** Vista previa estática del producto en el panel de marca: dos filas de biblioteca y un logro, como en Inicio. */
const SAMPLE_GAMES = [
    { appid: 1145350, name: 'Hades II', meta: '42 h · ayer', done: 38, total: 49, rarity: 'leg', chip: 'Jugando' },
    { appid: 2379780, name: 'Balatro', meta: '64 h · 12 oct', done: 30, total: 30, rarity: 'epica', chip: 'Completado' },
] as const

function BrandPreview() {
    return (
        <div className="auth__preview" aria-hidden>
            <ul className="hg-rows">
                {SAMPLE_GAMES.map((g) => {
                    const pct = Math.round((g.done / g.total) * 100)
                    const complete = g.done === g.total
                    return (
                        <li key={g.appid} className="hg-row has-rarity auth__row-sample" style={{ '--c': `var(--rar-${g.rarity})` } as CSSProperties}>
                            <span className="hg-row__cover">
                                <img src={`https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`} alt="" />
                            </span>
                            <span className="hg-row__main">
                                <span className="auth__sample-name">{g.name}</span>
                                <span className="hg-row__meta">{g.meta}</span>
                                <span className="hg-row__prog">
                                    <span className="hg-row__prog-label">
                                        <span>
                                            <b>{g.done}</b> / {g.total} logros
                                        </span>
                                        <span>{pct} %</span>
                                    </span>
                                    <span className={`hg-bar${complete ? ' is-done' : ''}`}>
                                        <span style={{ width: `${pct}%` }} />
                                    </span>
                                </span>
                            </span>
                            <span className={`hg-chip ${complete ? 'hg-chip--done' : 'hg-chip--playing'}`}>{g.chip}</span>
                        </li>
                    )
                })}
            </ul>
            <div className="hg-ach" style={{ '--c': 'var(--rar-leg)' } as CSSProperties}>
                <span className="hg-ach__icon">
                    <Trophy size={20} />
                </span>
                <span className="hg-ach__body">
                    <span className="hg-ach__name">Sin un rasguño</span>
                    <span className="hg-ach__game">Hades II · ayer</span>
                </span>
                <span className="hg-ach__pct">
                    0,8 %<small>Legendaria</small>
                </span>
            </div>
        </div>
    )
}

/** Layout común de login/registro: panel de marca con el producto + formulario. */
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
        <div className="auth">
            <aside className="auth__brand">
                <Logo size={26} animated={false} />
                <div className="auth__pitch">
                    <p className="auth__tagline">Tu biblioteca de Steam y tus logros, en orden.</p>
                    <p className="auth__tagline-sub">
                        Lo que juegas, lo que tienes pendiente y los logros que te faltan, sincronizado con Steam. Y cada día, un juego
                        que adivinar en JUDI.
                    </p>
                </div>
                <BrandPreview />
            </aside>
            <div className="auth__form-wrap">
                <div className="auth__form">
                    <div>
                        <h1 className="auth__title">{title}</h1>
                        <p className="auth__subtitle">{subtitle}</p>
                    </div>
                    <div className="auth__fields">{children}</div>
                </div>
            </div>
        </div>
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

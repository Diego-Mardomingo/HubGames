'use client'

import { useState } from 'react'
import { Eye, Lock, MonitorPlay } from 'lucide-react'
import { RARITY_LABELS, formatPercent, rarity, youtubeSearchUrl, type Achievement } from '@/lib/achievements'
import './achievements.css'

const DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

export function RarityBadge({ percent }: { percent: number | null }) {
    const tier = rarity(percent)
    if (!tier) return <span className="rarity rarity--none">Sin dato</span>
    return (
        <span className={`rarity rarity--${tier}`} title={`${formatPercent(percent)} de los jugadores lo tiene`}>
            {RARITY_LABELS[tier]} · {formatPercent(percent)}
        </span>
    )
}

interface Props {
    achievement: Achievement
    gameName: string
    /** Texto extra bajo la descripción (por ejemplo, el juego en /logros). */
    context?: React.ReactNode
}

/** Un logro: icono, nombre, descripción, rareza y fecha. Los ocultos bloqueados no enseñan el nombre hasta pulsar. */
export default function AchievementItem({ achievement: a, gameName, context }: Props) {
    const [revealed, setRevealed] = useState(false)
    const secret = a.hidden && !a.achieved && !revealed
    const name = a.display_name ?? a.apiname
    const icon = a.achieved ? a.icon : (a.icongray ?? a.icon)

    return (
        <li className={`ach-item ${a.achieved ? 'is-unlocked' : 'is-locked'}`}>
            <span className="ach-item__icon">
                {/* <img>: iconos del CDN de Steam; next/image gastaría transformaciones de Vercel Hobby. */}
                {icon && !secret ? <img src={icon} alt="" loading="lazy" width={48} height={48} /> : <Lock size={18} aria-hidden />}
            </span>
            <div className="ach-item__body">
                <p className="ach-item__name">
                    {secret ? (
                        <>
                            <span className="ach-item__secret">Logro oculto</span>
                            <button type="button" className="ach-item__reveal" onClick={() => setRevealed(true)}>
                                <Eye size={12} aria-hidden /> Revelar
                            </button>
                        </>
                    ) : (
                        name
                    )}
                </p>
                {!secret && a.description && <p className="ach-item__desc">{a.description}</p>}
                {context && <p className="ach-item__context">{context}</p>}
            </div>
            <div className="ach-item__meta">
                <RarityBadge percent={a.global_percent} />
                {a.achieved && a.unlocktime ? (
                    <time dateTime={a.unlocktime}>{DATE.format(new Date(a.unlocktime))}</time>
                ) : (
                    !secret && (
                        <a
                            className="ach-item__link"
                            href={youtubeSearchUrl(gameName, name)}
                            target="_blank"
                            rel="noreferrer"
                            title="Buscar en YouTube cómo conseguirlo"
                        >
                            <MonitorPlay size={13} aria-hidden /> Cómo conseguirlo
                        </a>
                    )
                )}
            </div>
        </li>
    )
}

'use client'

import { useState } from 'react'
import { Eye, Lock, MonitorPlay, Trophy } from 'lucide-react'
import { formatPercent, youtubeSearchUrl, type Achievement } from '@/lib/achievements'
import { RARITY_TIER_LABELS, rarityColor, rarityTier } from '@/lib/rarity'
import './achievements.css'
import { achievementIconUrl } from '@/lib/steam-icon'

const DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

type CSSVars = React.CSSProperties & Record<`--${string}`, string>

interface Props {
    achievement: Achievement
    gameName: string
    /** Texto extra bajo la descripción (por ejemplo, el juego en /logros). */
    context?: React.ReactNode
    /** Oculta la fecha de desbloqueo (en el historial ya está en el encabezado del día). */
    hideDate?: boolean
}

/**
 * Un logro: icono tintado y borde izquierdo con el color de su rareza, nombre, descripción, % global con el nombre de
 * la rareza y fecha. Los ocultos bloqueados no enseñan el nombre hasta pulsar.
 */
export default function AchievementItem({ achievement: a, gameName, context, hideDate }: Props) {
    const [revealed, setRevealed] = useState(false)
    const secret = a.hidden && !a.achieved && !revealed
    const name = a.display_name ?? a.apiname
    const icon = achievementIconUrl(a.achieved ? a.icon : (a.icongray ?? a.icon))
    const tier = rarityTier(a.global_percent)

    return (
        <li
            className={`hg-ach ach-item ${a.achieved ? 'is-unlocked' : 'is-locked'}`}
            style={tier ? ({ '--c': rarityColor(tier) } as CSSVars) : undefined}
        >
            <span className="hg-ach__icon ach-item__icon">
                {/* <img>: iconos del CDN de Steam; next/image gastaría transformaciones de Vercel Hobby. */}
                {icon && !secret ? (
                    <img src={icon} alt="" loading="lazy" width={32} height={32} />
                ) : a.achieved ? (
                    <Trophy size={18} aria-hidden />
                ) : (
                    <Lock size={16} aria-hidden />
                )}
            </span>
            <div className="hg-ach__body">
                <p className="hg-ach__name ach-item__name">
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
            <div className="hg-ach__pct ach-item__meta">
                {tier ? (
                    <span title={`${formatPercent(a.global_percent)} de los jugadores lo tiene`}>
                        {formatPercent(a.global_percent)}
                        <span className="sr-only"> de jugadores</span>
                    </span>
                ) : (
                    <span className="ach-item__nodata">Sin dato</span>
                )}
                {tier && <small>{RARITY_TIER_LABELS[tier]}</small>}
                {a.achieved && a.unlocktime ? (
                    !hideDate && (
                        <time className="ach-item__date" dateTime={a.unlocktime}>
                            {DATE.format(new Date(a.unlocktime))}
                        </time>
                    )
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

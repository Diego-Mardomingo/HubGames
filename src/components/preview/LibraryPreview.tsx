'use client'

import { Clock, Hourglass, Lock, ShoppingCart, Star, TrendingDown, Trophy } from 'lucide-react'
import type { GameStatus } from '@/lib/tracker'
import { LIST_ICONS, MarkFlags, StatusChip } from '@/components/tracker/status'
import GameCover from '@/components/tracker/GameCover'
import AnimatedCount from '@/components/AnimatedCount'
import '@/components/dashboard/dashboard.css'
import '@/components/wishlist/wishlist.css'
import './preview.css'

export const sampleHeader = (appid: number) => `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>

export type SampleRow = 'elden' | 'hades' | 'outer' | 'disco'
export type SamplePill = 'jugando' | 'pendiente' | 'completado' | 'bandeja'

const PILL_LABELS: Record<SamplePill, string> = { jugando: 'Jugando', pendiente: 'Pendiente', completado: 'Completado', bandeja: 'Bandeja' }

function Cover({ appid }: { appid: number }) {
    return (
        <span className="hg-row__cover lib-cover">
            <GameCover appid={appid} name={null} headerImage={sampleHeader(appid)} variant="header" sizes="112px" />
        </span>
    )
}

function Bar({ pct }: { pct: number }) {
    return (
        <span className="hg-row__prog">
            <span className="hg-row__prog-label">
                <span>{pct === 100 ? <b className="lib-perfect">100 %</b> : `${pct} %`}</span>
            </span>
            <span className={`hg-bar hg-bar--fill${pct === 100 ? ' is-done' : ''}`} aria-hidden>
                <span style={{ width: `${pct}%` }} />
            </span>
        </span>
    )
}

function Row({ id, step }: { id: SampleRow; step: number }) {
    if (id === 'elden') {
        return (
            <li className="hg-row lib-row pv-row st-jugando">
                <Cover appid={1245620} />
                <span className="hg-row__main">
                    <span className="lib-row__name">
                        <span className="hg-row__link">ELDEN RING</span>
                        <MarkFlags favorite endless={false} />
                    </span>
                    <span className="hg-row__meta lib-row__meta">
                        <span className="lib-meta">
                            <Clock /> 142 h
                        </span>
                        <span className="hg-score hg-tint sc-top">96</span>
                    </span>
                </span>
                <Bar pct={74} />
                <StatusChip status="jugando" />
            </li>
        )
    }
    if (id === 'hades') {
        const hades: GameStatus = step >= 1 ? 'jugando' : 'pendiente'
        return (
            <li className={`hg-row lib-row pv-row st-${hades}`}>
                <Cover appid={1145350} />
                <span className="hg-row__main">
                    <span className="lib-row__name">
                        <span className="hg-row__link">Hades II</span>
                    </span>
                    <span className="hg-row__meta lib-row__meta">
                        <span className="lib-meta">
                            <Hourglass /> Historia 22 h
                        </span>
                        <span className="hg-score hg-tint sc-top">95</span>
                    </span>
                </span>
                <Bar pct={0} />
                <span key={hades} className={`pv-chip${step >= 1 ? ' pv-swap' : ''}`}>
                    <StatusChip status={hades} />
                </span>
            </li>
        )
    }
    if (id === 'outer') {
        return (
            <li className="hg-row lib-row pv-row st-completado">
                <Cover appid={753640} />
                <span className="hg-row__main">
                    <span className="lib-row__name">
                        <span className="hg-row__link">Outer Wilds</span>
                    </span>
                    <span className="hg-row__meta lib-row__meta">
                        <span className="lib-meta">
                            <Clock /> 24 h
                        </span>
                        <span className="hg-score hg-tint sc-top">
                            <Star /> 9,5
                        </span>
                    </span>
                </span>
                <Bar pct={100} />
                <StatusChip status="completado" />
            </li>
        )
    }
    return (
        <li className="hg-row lib-row pv-row st-pendiente is-unowned">
            <Cover appid={632470} />
            <span className="hg-row__main">
                <span className="lib-row__name">
                    <span className="hg-row__link">Disco Elysium - The Final Cut</span>
                </span>
                <span className="hg-row__meta lib-row__meta">
                    <span className="lib-own lib-own--no">
                        <ShoppingCart /> Sin comprar
                    </span>
                    <span className="hg-score hg-tint sc-top">97</span>
                </span>
            </span>
            <span className="price-tag">
                <span className="price-tag__cut hg-tint sc-top">-75 %</span>
                <span className="price-tag__now">
                    <strong>9,99 €</strong>
                </span>
                <span className={`hg-deal price-tag__low${step >= 3 ? ' pv-flash' : ''}`}>
                    <TrendingDown /> Mínimo histórico
                </span>
            </span>
            <StatusChip status="pendiente" />
        </li>
    )
}

/**
 * Biblioteca de ejemplo «en acción»: raíl con contadores por lista y filas con su franja y su chip.
 * La comparten la portada sin sesión y el login/registro (`AuthShell`); el paso sale de `usePreviewSteps`.
 * `bare`: sin marco ni cabecera (vista previa reducida del móvil).
 */
export function LibraryPreview({
    step,
    rows,
    pills = ['jugando', 'pendiente', 'completado', 'bandeja'],
    bare = false,
    label,
    className,
    style,
}: {
    step: number
    rows: SampleRow[]
    pills?: SamplePill[]
    bare?: boolean
    /** Si se da, la ventana es una imagen con esta descripción para lectores de pantalla; si no, se oculta. */
    label?: string
    className?: string
    style?: React.CSSProperties
}) {
    const counts: Record<SamplePill, number> = {
        jugando: step >= 1 ? 2 : 1,
        pendiente: step >= 1 ? 36 : 37,
        completado: 58,
        bandeja: 14,
    }
    return (
        <div className={['pv-win', bare && 'pv-win--bare', className].filter(Boolean).join(' ')} style={style} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
            {!bare && (
                <div className="pv-win__head" aria-hidden>
                    <span className="pv-win__title">Biblioteca</span>
                    <span className="pv-win__tag">Ejemplo</span>
                </div>
            )}
            <div className="pv-win__rail" aria-hidden>
                {pills.map((key) => {
                    const Icon = LIST_ICONS[key]
                    return (
                        <span key={key} className={`dash-list dash-list--mini st-${key}`}>
                            <span className="dash-list__icon hg-tint">
                                <Icon />
                            </span>
                            {PILL_LABELS[key]}
                            <b>
                                <AnimatedCount value={counts[key]} />
                            </b>
                        </span>
                    )
                })}
            </div>
            <ul className="hg-rows" aria-hidden>
                {rows.map((id) => (
                    <Row key={id} id={id} step={step} />
                ))}
            </ul>
        </div>
    )
}

/** Logro épico que te falta y se desbloquea en el paso 2, con el destello de su rareza. `context`: juego delante del cuándo. */
export function UnlockAchievement({ unlocked, context }: { unlocked: boolean; context?: string }) {
    const when = unlocked ? 'ahora mismo' : 'Te falta'
    return (
        <li
            className={`hg-ach pv-unlock${unlocked ? ' hg-rar-flash is-on' : ' is-locked'}`}
            style={unlocked ? ({ '--c': 'var(--rar-epica)', animationDelay: '0s' } as CSSVars) : undefined}
        >
            <span className="hg-ach__icon">{unlocked ? <Trophy size={16} /> : <Lock size={16} />}</span>
            <span className="hg-ach__body">
                <span className="hg-ach__name">Paz en el Abismo</span>
                <span className="hg-ach__game">{context ? `${context} · ${when}` : when}</span>
            </span>
            <span className="hg-ach__pct">
                <span>3,1 %</span>
                <small>Épica</small>
            </span>
        </li>
    )
}

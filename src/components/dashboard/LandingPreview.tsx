'use client'

import { useEffect, useState } from 'react'
import { Clock, Gamepad2, Hourglass, Lock, ShoppingCart, Star, Tag, ThumbsUp, TrendingDown, Trophy, X } from 'lucide-react'
import type { GameStatus } from '@/lib/tracker'
import { LIST_ICONS, MarkFlags, StatusChip } from '@/components/tracker/status'
import GameCover from '@/components/tracker/GameCover'
import AnimatedCount from '@/components/AnimatedCount'
import '@/components/wishlist/wishlist.css'

const header = (appid: number) => `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>

/** Pasos de la vista previa «en acción»: 1 Hades II pasa a Jugando, 2 se desbloquea un logro, 3 destella el mínimo. */
const STEPS = [700, 1200, 1600]

function Cover({ appid }: { appid: number }) {
    return (
        <span className="hg-row__cover lib-cover">
            <GameCover appid={appid} name={null} headerImage={header(appid)} variant="header" sizes="112px" />
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

/**
 * Vista previa de la portada sin sesión: una biblioteca de ejemplo y tres tarjetas (precios, logros por rareza y JUDI).
 * Se pone «en acción» una vez al cargar; con `prefers-reduced-motion`, directamente en su estado final.
 */
export default function LandingPreview() {
    const [step, setStep] = useState(0)

    useEffect(() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const timers = (reduced ? [0] : STEPS).map((ms, i) => window.setTimeout(() => setStep(reduced ? STEPS.length : i + 1), ms))
        return () => timers.forEach(clearTimeout)
    }, [])

    const hades: GameStatus = step >= 1 ? 'jugando' : 'pendiente'
    const unlocked = step >= 2
    const pills: { key: GameStatus; label: string; n: number }[] = [
        { key: 'jugando', label: 'Jugando', n: step >= 1 ? 2 : 1 },
        { key: 'pendiente', label: 'Pendiente', n: step >= 1 ? 36 : 37 },
        { key: 'completado', label: 'Completado', n: 58 },
        { key: 'bandeja', label: 'Bandeja', n: 14 },
    ]

    return (
        <>
            <div className="land-win hg-enter" style={{ '--i': 2 } as CSSVars} aria-label="Ejemplo de biblioteca" role="img">
                <div className="land-win__head" aria-hidden>
                    <span className="land-win__title">Biblioteca</span>
                    <span className="land-win__tag">Ejemplo</span>
                </div>
                <div className="land-win__rail" aria-hidden>
                    {pills.map(({ key, label, n }) => {
                        const Icon = LIST_ICONS[key]
                        return (
                            <span key={key} className={`dash-list dash-list--mini st-${key}`}>
                                <span className="dash-list__icon hg-tint">
                                    <Icon />
                                </span>
                                {label}
                                <b>
                                    <AnimatedCount value={n} />
                                </b>
                            </span>
                        )
                    })}
                </div>
                <ul className="hg-rows" aria-hidden>
                    <li className="hg-row lib-row land-row st-jugando">
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
                    <li className={`hg-row lib-row land-row st-${hades}`}>
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
                        <span key={hades} className={step >= 1 ? 'land-swap' : undefined}>
                            <StatusChip status={hades} />
                        </span>
                    </li>
                    <li className="hg-row lib-row land-row st-completado">
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
                    <li className="hg-row lib-row land-row st-pendiente is-unowned">
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
                            <span className={`hg-deal price-tag__low${step >= 3 ? ' land-flash' : ''}`}>
                                <TrendingDown /> Mínimo histórico
                            </span>
                        </span>
                        <StatusChip status="pendiente" />
                    </li>
                </ul>
            </div>

            <div className="land-cards">
                <article className="land-card hg-enter" style={{ '--i': 3 } as CSSVars}>
                    <header className="land-card__head">
                        <span className="dash-sec__icon hg-tint sc-top" aria-hidden>
                            <Tag />
                        </span>
                        <h2>Cada precio, con veredicto</h2>
                        <p>Puntuaciones con color y el mínimo histórico en amarillo.</p>
                    </header>
                    <div className="land-card__body" aria-hidden>
                        <span className="land-ficha__img">
                            <GameCover appid={1086940} name="Baldur's Gate 3" headerImage={header(1086940)} variant="header" sizes="(max-width: 640px) 90vw, 360px" />
                        </span>
                        <b className="land-ficha__name">Baldur&apos;s Gate 3</b>
                        <span className="land-ficha__scores">
                            <span>
                                <span className="hg-score hg-tint sc-top">96</span> Aclamado
                            </span>
                            <span>
                                <span className="hg-score hg-tint sc-top">
                                    <ThumbsUp /> 96 %
                                </span>{' '}
                                Extremadamente positivas
                            </span>
                        </span>
                        <span className={`land-verdict${step >= 3 ? ' land-flash' : ''}`}>
                            <TrendingDown /> Mínimo histórico <span className="land-verdict__price">47,99 €</span>
                        </span>
                    </div>
                </article>

                <article className="land-card hg-enter" style={{ '--i': 4 } as CSSVars}>
                    <header className="land-card__head">
                        <span className="dash-sec__icon hg-tint rar-ink" style={{ '--c': 'var(--rar-epica)' } as CSSVars} aria-hidden>
                            <Trophy />
                        </span>
                        <h2>Logros por rareza</h2>
                        <p>De común a legendaria, y los que te faltan para el 100 %.</p>
                    </header>
                    <div className="land-card__body" aria-hidden>
                        <span className="land-ach__head">
                            <b>Hollow Knight</b>
                            <span>
                                <b>
                                    <AnimatedCount value={unlocked ? 44 : 43} />
                                </b>{' '}
                                / 63 logros
                            </span>
                        </span>
                        <span className="land-stack">
                            {(
                                [
                                    ['comun', 14],
                                    ['poco', 12],
                                    ['rara', 10],
                                    ['epica', unlocked ? 7 : 6],
                                    ['leg', 1],
                                ] as const
                            ).map(([t, n]) => (
                                <span key={t} style={{ flexGrow: n, '--c': `var(--rar-${t})` } as CSSVars} />
                            ))}
                            <span className="land-stack__rest" style={{ flexGrow: unlocked ? 19 : 20 }} />
                        </span>
                        <ul className="hg-achs">
                            <li className="hg-ach" style={{ '--c': 'var(--rar-leg)' } as CSSVars}>
                                <span className="hg-ach__icon">
                                    <Trophy size={16} />
                                </span>
                                <span className="hg-ach__body">
                                    <span className="hg-ach__name">Hollow Knight puro</span>
                                    <span className="hg-ach__game">hace 2 días</span>
                                </span>
                                <span className="hg-ach__pct">
                                    <span>0,9 %</span>
                                    <small>Legendaria</small>
                                </span>
                            </li>
                            <li className={`hg-ach land-unlock${unlocked ? ' hg-rar-flash is-on' : ' is-locked'}`} style={unlocked ? ({ '--c': 'var(--rar-epica)', animationDelay: '0s' } as CSSVars) : undefined}>
                                <span className="hg-ach__icon">{unlocked ? <Trophy size={16} /> : <Lock size={16} />}</span>
                                <span className="hg-ach__body">
                                    <span className="hg-ach__name">Paz en el Abismo</span>
                                    <span className="hg-ach__game">{unlocked ? 'ahora mismo' : 'Te falta'}</span>
                                </span>
                                <span className="hg-ach__pct">
                                    <span>3,1 %</span>
                                    <small>Épica</small>
                                </span>
                            </li>
                        </ul>
                    </div>
                </article>

                <article className="land-card hg-enter" style={{ '--i': 5 } as CSSVars}>
                    <header className="land-card__head">
                        <span className="dash-sec__icon hg-tint" aria-hidden>
                            <Gamepad2 />
                        </span>
                        <h2>JUDI, cada día</h2>
                        <p>Adivina el juego por su captura. Sin cuenta, cuando quieras.</p>
                    </header>
                    <div className="land-card__body" aria-hidden>
                        <span className="land-shot">
                            <GameCover appid={413150} name={null} headerImage={header(413150)} variant="header" sizes="(max-width: 640px) 90vw, 360px" />
                            <span className="land-shot__tag">Captura 3 de 6</span>
                        </span>
                        <span className="land-tries">
                            <span className="dash-pill hg-tint dash-ko">
                                <X /> Terraria
                            </span>
                            <span className="dash-pill land-tries__skip">Saltado</span>
                            <span className="dash-pill hg-tint dash-warn">
                                <Clock /> Tu turno
                            </span>
                        </span>
                    </div>
                </article>
            </div>
        </>
    )
}

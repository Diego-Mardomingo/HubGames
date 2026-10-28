'use client'

import { Clock, Gamepad2, ThumbsUp, TrendingDown, Tag, Trophy, X } from 'lucide-react'
import GameCover from '@/components/tracker/GameCover'
import AnimatedCount from '@/components/AnimatedCount'
import { LibraryPreview, UnlockAchievement, sampleHeader as header } from '@/components/preview/LibraryPreview'
import { usePreviewSteps } from '@/components/preview/usePreviewSteps'

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>

/**
 * Vista previa de la portada sin sesión: una biblioteca de ejemplo y tres tarjetas (precios, logros por rareza y JUDI).
 * Se pone «en acción» una vez al cargar (`usePreviewSteps`, compartido con el login); con `prefers-reduced-motion`, directamente en su estado final.
 */
export default function LandingPreview() {
    const step = usePreviewSteps()
    const unlocked = step >= 2

    return (
        <>
            <LibraryPreview className="hg-enter" style={{ '--i': 2 } as CSSVars} step={step} rows={['elden', 'hades', 'outer', 'disco']} label="Ejemplo de biblioteca" />

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
                        <span className={`land-verdict${step >= 3 ? ' pv-flash' : ''}`}>
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
                            <UnlockAchievement unlocked={unlocked} />
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

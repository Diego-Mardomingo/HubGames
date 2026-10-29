'use client'

import { useMemo } from 'react'
import { Check, Gauge, Zap } from 'lucide-react'
import { DIFFICULTY_LABELS, estimateDifficulty, formatPercent, pointsOf, type Achievement } from '@/lib/achievements'
import { DIFFICULTY_TIERS, lastUnlock, rarityColumns } from '@/lib/game-achievements'
import { RARITY_TIER_LABELS, rarityColor, type RarityTier } from '@/lib/rarity'
import CountUp from '@/components/CountUp'

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>

const DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const n = (v: number) => v.toLocaleString('es-ES')

interface Props {
    list: Achievement[]
    /** Rareza por la que se filtra la lista (variante A: el filtro vive en las columnas). */
    rarity: RarityTier | null
    onRarity: (tier: RarityTier) => void
}

/**
 * Resumen de los logros de un juego, como el de la ficha: anillo (cobalto; verde y cerrado al 100 %, con pulso y sello),
 * puntos de cazador, dificultad para el 100 % con el color de su rareza y una columna por rareza que filtra la lista.
 */
export default function AchievementsSummary({ list, rarity, onRarity }: Props) {
    const { unlocked, points, difficulty, columns, last } = useMemo(
        () => ({
            unlocked: list.filter((a) => a.achieved).length,
            points: pointsOf(list),
            difficulty: estimateDifficulty(list),
            columns: rarityColumns(list),
            last: lastUnlock(list),
        }),
        [list],
    )
    const total = list.length
    const pct = Math.floor((unlocked / total) * 100)
    const done = unlocked === total

    return (
        <section className="gl-sum hg-enter" style={{ '--i': 1 } as CSSVars} aria-label="Progreso">
            <div className="gl-ringbox">
                <div className={`hg-ring gl-ring${done ? ' is-done' : ''}`} role="img" aria-label={`${unlocked} de ${total} logros, ${pct} %`}>
                    <svg viewBox="0 0 36 36" aria-hidden>
                        <circle cx="18" cy="18" r="15.5" className="hg-ring__track" />
                        {pct > 0 && <circle cx="18" cy="18" r="15.5" pathLength={100} className="hg-ring__fill" style={{ strokeDashoffset: 100 - pct }} />}
                    </svg>
                    <span className="hg-ring__text" aria-hidden>
                        <b>
                            <CountUp value={pct} /> %
                        </b>
                        <span>
                            {unlocked} de {total}
                        </span>
                    </span>
                </div>
            </div>

            <div className="gl-sum__main">
                <div className="gl-sum__top">
                    <p className="gl-pts" title="Puntos según la rareza de cada logro">
                        <span className="gl-pts__v">
                            <strong>
                                <CountUp value={points.earned} />
                            </strong>
                            <small>de {n(points.possible)}</small>
                        </span>
                        <span className="gl-pts__label">
                            <Zap aria-hidden /> puntos de cazador
                        </span>
                    </p>
                    {difficulty ? (
                        <p className="gl-diff">
                            <span className="ach-difficulty gl-diff__level" style={{ '--c': rarityColor(DIFFICULTY_TIERS[difficulty.level]) } as CSSVars}>
                                <Gauge aria-hidden /> {DIFFICULTY_LABELS[difficulty.level]}
                            </span>{' '}
                            para el 100 %: te{' '}
                            {difficulty.remaining === 1 ? (
                                <>
                                    falta <b>1 logro</b>
                                </>
                            ) : (
                                <>
                                    faltan <b>{difficulty.remaining} logros</b>
                                </>
                            )}
                            {difficulty.rarest !== null && (
                                <>
                                    , el más raro lo tiene el <b>{formatPercent(difficulty.rarest)}</b>
                                </>
                            )}
                            {difficulty.hard > 1 && ` y ${difficulty.hard} son raros o más`}.
                        </p>
                    ) : (
                        <p className="gl-diff">
                            <span className="hg-seal">
                                <Check aria-hidden />
                                100 %
                            </span>{' '}
                            Todos los logros desbloqueados.
                            {last && (
                                <>
                                    {' '}
                                    El último, el <b>{DATE.format(new Date(last))}</b>.
                                </>
                            )}
                        </p>
                    )}
                </div>

                {columns.length > 0 && (
                    <>
                        <ul className="gl-tiers" aria-label="Conseguidos por rareza; pulsa para filtrar">
                            {columns.map((c, k) => {
                                const label = RARITY_TIER_LABELS[c.tier]
                                return (
                                    <li key={c.tier}>
                                        <button
                                            type="button"
                                            className="gl-tier"
                                            style={{ '--c': rarityColor(c.tier), '--k': k } as CSSVars}
                                            aria-pressed={rarity === c.tier}
                                            title={rarity === c.tier ? 'Quitar el filtro de rareza' : `Ver solo los de rareza ${label.toLowerCase()}`}
                                            onClick={() => onRarity(c.tier)}
                                        >
                                            <span className="gl-tier__name rar-ink">
                                                {label}
                                                <Check aria-hidden />
                                            </span>
                                            <span className="gl-tier__n">
                                                {c.unlocked}
                                                <small> / {c.total}</small>
                                                {c.unlocked === c.total && (
                                                    <span className="gl-tier__done" title="Todos">
                                                        <Check aria-hidden />
                                                        <span className="sr-only"> (todos)</span>
                                                    </span>
                                                )}
                                            </span>
                                            <span className="hg-bar" aria-hidden>
                                                <span style={{ width: `${Math.round((c.unlocked / c.total) * 100)}%` }} />
                                            </span>
                                            <span className="gl-tier__pts">
                                                <b>{n(c.earned)}</b> de {n(c.possible)} pts
                                            </span>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                        <p className="gl-tiers__hint">Pulsa una rareza para ver solo sus logros.</p>
                    </>
                )}
            </div>
        </section>
    )
}

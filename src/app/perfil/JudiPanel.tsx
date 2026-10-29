import type { CSSProperties } from 'react'
import Link from 'next/link'
import { Check, ChevronRight, Play, TrendingUp, Trophy, X } from 'lucide-react'
import CountUp from '@/components/CountUp'
import { Button } from '@/components/ui/button'
import { beatPercent, topWithSelf, type JudiStats } from '@/lib/profile'
import { enter } from './Section'

type Entry = { userId: string; username: string; points: number; rank?: number }

function Row({ entry, rank, self }: { entry: Entry; rank: number; self: boolean }) {
    return (
        <li className={`pf-top__row${self ? ' is-self' : ''}`}>
            <span className={`pf-top__rank${rank <= 3 ? ` pf-top__rank--${rank} hg-pop-in` : ''}`} style={{ '--i': rank } as CSSProperties}>
                {rank}
            </span>
            <span className="pf-top__name">
                <span>{entry.username}</span>
                {self && <span className="pf-you">Tú</span>}
            </span>
            <span className="pf-top__pts">
                {entry.points.toLocaleString('es-ES')} <small>pts</small>
            </span>
        </li>
    )
}

/**
 * JUDI en un solo panel: tus cifras (puntos en cobalto, puesto, aciertos en verde, fallos en rojo, precisión, «Superas al N %»)
 * y el top 5 con tu fila resaltada, o tu puesto tras «···» si estás fuera. Trofeo en legendaria y medallas oro, plata y bronce (`--medal-*`, como /ranking).
 */
export default function JudiPanel({ stats, ranking, userId, index }: { stats: JudiStats; ranking: Entry[]; userId: string; index: number }) {
    const { top, self, rank } = topWithSelf(ranking, userId)
    const beat = beatPercent(rank, ranking.length)

    return (
        <section className="pf-panel pf-judi hg-enter" style={enter(index)} aria-labelledby="pf-judi">
            <header className="dash-sec__head">
                <span className="dash-sec__icon hg-tint dash-leg" aria-hidden>
                    <Trophy />
                </span>
                <h2 id="pf-judi" className="dash-sec__title">
                    JUDI
                </h2>
                <span className="dash-sec__end">
                    <Link href="/ranking" className="dash-link pf-more">
                        Ver el ranking
                        <ChevronRight aria-hidden />
                    </Link>
                </span>
            </header>

            {stats.total === 0 ? (
                <div className="pf-judi__empty">
                    <p className="pf-empty">Aún no has terminado ningún JUDI. Adivina el juego del día por su captura.</p>
                    <Button asChild size="sm">
                        <Link href="/judi">
                            <Play data-icon="inline-start" aria-hidden /> Jugar al de hoy
                        </Link>
                    </Button>
                </div>
            ) : (
                <>
                    <div className="pf-judi__big">
                        <div className="pf-judi__pts">
                            <b>
                                <CountUp value={stats.puntos} />
                            </b>
                            <small>puntos</small>
                        </div>
                        {rank !== null && (
                            <span className="pf-rank hg-tint st-todos">
                                <b>{rank}.º</b> de {ranking.length}
                            </span>
                        )}
                    </div>
                    <div className="pf-split" role="img" aria-label={`${stats.aciertos} aciertos y ${stats.fallos} fallos`}>
                        {stats.aciertos > 0 && <i className="dash-ok" style={{ '--v': stats.aciertos } as CSSProperties} />}
                        {stats.fallos > 0 && <i className="dash-ko" style={{ '--v': stats.fallos } as CSSProperties} />}
                    </div>
                    <dl className="pf-kpis">
                        <div className="pf-kpi dash-ok">
                            <dt>
                                <Check aria-hidden /> aciertos
                            </dt>
                            <dd>
                                <CountUp value={stats.aciertos} />
                            </dd>
                        </div>
                        <div className="pf-kpi dash-ko">
                            <dt>
                                <X aria-hidden /> fallos
                            </dt>
                            <dd>
                                <CountUp value={stats.fallos} />
                            </dd>
                        </div>
                        <div className="pf-kpi">
                            <dt>
                                de {stats.total.toLocaleString('es-ES')} {stats.total === 1 ? 'partida' : 'partidas'}
                            </dt>
                            <dd>{stats.precision} %</dd>
                        </div>
                    </dl>
                    <p className="pf-judi__beat">
                        <TrendingUp aria-hidden />
                        {beat !== null ? (
                            <span>
                                Superas al <b>{beat} %</b> de los jugadores de JUDI.
                            </span>
                        ) : ranking.length === 0 ? (
                            <span>Aún no hay clasificación.</span>
                        ) : (
                            <span>Termina partidas para aparecer en el ranking.</span>
                        )}
                    </p>
                </>
            )}

            <p className="pf-judi__sub">
                <Trophy aria-hidden /> Mejores jugadores
            </p>
            {top.length === 0 ? (
                <p className="pf-empty">Aún no hay clasificación: nadie ha terminado un JUDI.</p>
            ) : (
                <ol className="pf-top">
                    {top.map((entry, i) => (
                        <Row key={entry.userId} entry={entry} rank={entry.rank ?? i + 1} self={entry.userId === userId} />
                    ))}
                    {self && (
                        <>
                            <li className="pf-top__gap" aria-hidden>
                                ···
                            </li>
                            <Row entry={self.entry} rank={self.rank} self />
                        </>
                    )}
                </ol>
            )}
        </section>
    )
}

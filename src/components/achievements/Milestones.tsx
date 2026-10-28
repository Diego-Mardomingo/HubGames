import { Award, Check, Flag, Trophy, type LucideIcon } from 'lucide-react'
import { seriesProgress, type Milestones as MilestonesData, type MilestoneSeries } from '@/lib/achievements'
import { RARITY_TIER_LABELS } from '@/lib/rarity'
import './achievements.css'

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>

const DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const MONTH = new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric' })
const n = (v: number) => v.toLocaleString('es-ES')

/** Color e icono de cada serie: logros como Sin final (igual que en la ficha), juegos al 100 % como Completado y rarezas con la suya. */
function seriesOf(id: string): { tone: string; Icon: LucideIcon } {
    if (id.startsWith('logros-')) return { tone: 'st-sin_final', Icon: Award }
    if (id.startsWith('perfectos-')) return { tone: 'st-completado', Icon: Flag }
    return { tone: id === 'primer-legendario' ? 'rar-leg' : 'rar-epica', Icon: Trophy }
}

function Series({ tone, Icon, title, series, format }: { tone: string; Icon: LucideIcon; title: string; series: MilestoneSeries; format: (v: number) => string }) {
    const { current, steps } = series
    const lit = steps.filter((s) => s.reached).length
    const next = steps[lit]
    const progress = seriesProgress(current, steps.map((s) => s.value))
    return (
        <div className={`lg-ms ${tone}`}>
            <p className="lg-ms__head">
                <b>
                    <Icon aria-hidden /> {title}
                </b>
                {next ? (
                    <span>
                        <strong>{n(current)}</strong> · te faltan {n(next.value - current)} para {format(next.value)}
                    </span>
                ) : (
                    <span>Completada</span>
                )}
            </p>
            <div className="lg-ms__track" style={{ '--n': steps.length } as CSSVars}>
                <span className="lg-ms__line" aria-hidden>
                    <span style={{ '--p': progress.toFixed(3) } as CSSVars} />
                </span>
                <ol className="lg-ms__nodes">
                    {steps.map((s, i) => (
                        <li
                            key={s.id}
                            className={`lg-ms__node${s.reached ? ' is-lit' : i === lit ? ' is-next' : ''}`}
                            style={{ '--k': i } as CSSVars}
                            title={s.reached ? (s.date ? `${s.label}: conseguido el ${DATE.format(new Date(s.date))}` : `${s.label}: conseguido`) : s.label}
                        >
                            <span className="lg-ms__dot" aria-hidden>
                                {s.reached && <Check />}
                            </span>
                            <span className="lg-ms__label">{format(s.value)}</span>
                            <span className="sr-only">{s.reached ? ' (conseguido)' : i === lit ? ' (el siguiente)' : ' (pendiente)'}</span>
                            {s.reached && s.date && (
                                <time className="lg-ms__date" dateTime={s.date}>
                                    {MONTH.format(new Date(s.date))}
                                </time>
                            )}
                        </li>
                    ))}
                </ol>
            </div>
        </div>
    )
}

/**
 * Hitos en tres series (logros, juegos al 100 % y rarezas) con todos sus escalones: los alcanzados se encienden en orden,
 * la línea llega hasta donde vas y el siguiente lleva borde discontinuo. Arriba, el último hito alcanzado.
 */
export default function Milestones({ data }: { data: MilestonesData }) {
    const { count, perfect, rare } = data.series
    const last = data.reached[0]
    const lastSeries = last ? seriesOf(last.id) : null
    const rareLit = rare.filter((r) => r.reached).length
    return (
        <>
            {last && lastSeries && (
                <p className={`lg-ms-last ${lastSeries.tone}`}>
                    <lastSeries.Icon aria-hidden />
                    <b>{last.label}</b>
                    <span>· último hito{last.date ? `, ${DATE.format(new Date(last.date))}` : ''}</span>
                </p>
            )}
            <div className="lg-ms-series">
                <Series tone="st-sin_final" Icon={Award} title="Logros" series={count} format={n} />
                <Series tone="st-completado" Icon={Flag} title="Juegos al 100 %" series={perfect} format={String} />
                <div className="lg-ms rar-leg">
                    <p className="lg-ms__head">
                        <b>
                            <Trophy aria-hidden /> Rarezas
                        </b>
                        <span>{rareLit === rare.length ? 'Completada' : rareLit === 0 ? 'Aún sin épicos ni legendarios' : `Te falta el ${rare.find((r) => !r.reached)!.label.toLowerCase()}`}</span>
                    </p>
                    <div className="lg-ms__track" style={{ '--n': rare.length } as CSSVars}>
                        <span className="lg-ms__line rar-epica" aria-hidden>
                            <span style={{ '--p': rareLit === rare.length ? 1 : 0 } as CSSVars} />
                        </span>
                        <ol className="lg-ms__nodes">
                            {rare.map((r, i) => (
                                <li
                                    key={r.id}
                                    className={`lg-ms__node rar-${r.tier}${r.reached ? ' is-lit' : i === rareLit ? ' is-next' : ''}`}
                                    style={{ '--k': i } as CSSVars}
                                    title={r.reached && r.date ? `${r.label}: conseguido el ${DATE.format(new Date(r.date))}` : `${r.label} (${RARITY_TIER_LABELS[r.tier].toLowerCase()})`}
                                >
                                    <span className="lg-ms__dot" aria-hidden>
                                        {r.reached && <Check />}
                                    </span>
                                    <span className="lg-ms__label">{r.label.replace('Primer logro ', 'Primer ')}</span>
                                    <span className="sr-only">{r.reached ? ' (conseguido)' : ' (pendiente)'}</span>
                                    {r.reached && r.date && (
                                        <time className="lg-ms__date" dateTime={r.date}>
                                            {DATE.format(new Date(r.date))}
                                        </time>
                                    )}
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            </div>
        </>
    )
}

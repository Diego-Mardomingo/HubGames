import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { MONTH_SHORT, delta, type YearStats } from '@/lib/stats'
import { formatHours } from '@/lib/format'
import { formatPercent } from '@/lib/achievements'
import { RARITY_TIER_LABELS, rarityColor, rarityTier } from '@/lib/rarity'
import GameCover from '@/components/tracker/GameCover'

const DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' })
const NUMBER = new Intl.NumberFormat('es-ES')

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>

function decimal(n: number): string {
    return String(n).replace('.', ',')
}

function Panel({ id, title, hint, children, wide }: { id: string; title: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
    return (
        <section className={`stats-panel glass${wide ? ' stats-panel--wide' : ''}`} aria-labelledby={id}>
            <header className="stats-panel__head">
                <h2 id={id} className="stats-panel__title">
                    {title}
                </h2>
                {hint && <p className="stats-panel__hint">{hint}</p>}
            </header>
            {children}
        </section>
    )
}

/** Cifra del año con la diferencia respecto al anterior: texto grande + etiqueta pequeña. */
function Kpi({ label, value, diff, unit, previousYear }: { label: string; value: string; diff: number | null; unit?: string; previousYear: number }) {
    const sign = diff === null || diff === 0 ? 'same' : diff > 0 ? 'up' : 'down'
    return (
        <div className="stats-kpi">
            <dt>{label}</dt>
            <dd className="stats-kpi__value">{value}</dd>
            <dd className={`stats-kpi__diff stats-kpi__diff--${sign}`}>
                {diff === null
                    ? `Sin datos de ${previousYear}`
                    : diff === 0
                      ? `Igual que en ${previousYear}`
                      : `${diff > 0 ? '+' : '−'}${decimal(Math.abs(diff))}${unit ?? ''} vs ${previousYear}`}
            </dd>
        </div>
    )
}

/** Escala "redonda" para el eje: 3–5 marcas enteras (0, 5, 10, 15…) que cubren el máximo. */
function niceScale(max: number): { top: number; ticks: number[] } {
    if (max <= 0) return { top: 1, ticks: [0] }
    const raw = max / 4
    const magnitude = 10 ** Math.floor(Math.log10(raw))
    const norm = raw / magnitude
    const step = Math.max(1, (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * magnitude)
    const top = Math.ceil(max / step) * step
    return { top, ticks: Array.from({ length: top / step + 1 }, (_, i) => i * step) }
}

/**
 * Columnas de una serie (logros por mes, notas). Sin librería: rejilla de filetes con marcas redondas, columnas finas
 * ancladas a la base y el máximo con etiqueta directa. Cada columna es enfocable y muestra su valor al pasar el ratón
 * o con el teclado; aria-label lo deja también para lectores de pantalla.
 */
function Columns({ values, labels, describe }: { values: number[]; labels: string[]; describe: (value: number, label: string) => string }) {
    const max = Math.max(...values, 0)
    const { top, ticks } = niceScale(max)
    const peak = values.indexOf(max)
    const pct = (v: number) => `${(v / top) * 100}%`
    return (
        <div className="stats-chart">
            <div className="stats-chart__axis" aria-hidden>
                {ticks.map((t) => (
                    <span key={t} style={{ bottom: pct(t) }}>
                        {NUMBER.format(t)}
                    </span>
                ))}
            </div>
            <ol className="stats-cols" style={{ '--n': values.length } as CSSVars}>
                <li className="stats-chart__grid" aria-hidden>
                    {ticks.map((t) => (
                        <i key={t} style={{ bottom: pct(t) }} />
                    ))}
                </li>
                {values.map((v, i) => (
                    <li key={labels[i]} className="stats-cols__item" tabIndex={0} aria-label={describe(v, labels[i])}>
                        <span className="stats-cols__track">
                            {v > 0 && (
                                <span className="stats-cols__bar" style={{ height: pct(v) }}>
                                    {i === peak && <span className="stats-cols__value">{NUMBER.format(v)}</span>}
                                </span>
                            )}
                            <span className="stats-tip" style={{ bottom: `calc(${pct(v)} + 8px)` }} aria-hidden>
                                {describe(v, labels[i])}
                            </span>
                        </span>
                        <span className="stats-cols__label" aria-hidden>
                            {labels[i]}
                        </span>
                    </li>
                ))}
            </ol>
        </div>
    )
}

/** Barras horizontales con etiqueta y valor directos (más jugados, géneros): una serie, longitud relativa al primero. */
function Bars({ rows }: { rows: { key: string | number; label: React.ReactNode; value: number; display: string }[] }) {
    const max = Math.max(...rows.map((r) => r.value), 0)
    return (
        <ol className="stats-bars">
            {rows.map((r) => (
                <li key={r.key}>
                    <span className="stats-bars__label">
                        {r.label}
                        <span className="stats-bars__value">{r.display}</span>
                    </span>
                    <span className="stats-bars__bar" style={{ width: max > 0 ? `${(r.value / max) * 100}%` : 0 }} aria-hidden />
                </li>
            ))}
        </ol>
    )
}

/** Un año de estadísticas: cifras con la diferencia respecto al anterior y los paneles con gráficos. */
export default function YearView({ s, prev, rarestGame }: { s: YearStats; prev: YearStats; rarestGame: string | null }) {
    const hours = `${s.hoursMeasured ? '' : '≈ '}${formatHours(s.minutes)}`
    const rarestTier = s.rarest ? rarityTier(s.rarest.global_percent) : null
    return (
        <>
            <div className="stats-summary">
                <dl className="stats-kpis">
                    <Kpi label="Completados" value={String(s.completed.length)} diff={delta(s.completed.length, prev.completed.length)} previousYear={prev.year} />
                    <Kpi
                        label={s.hoursMeasured ? 'Horas jugadas' : 'Horas (aprox.)'}
                        value={hours}
                        diff={delta(Math.round(s.minutes / 60), Math.round(prev.minutes / 60))}
                        unit=" h"
                        previousYear={prev.year}
                    />
                    <Kpi label="Logros" value={NUMBER.format(s.unlocks)} diff={delta(s.unlocks, prev.unlocks)} previousYear={prev.year} />
                    <Kpi label="Juegos al 100 %" value={String(s.perfect.length)} diff={delta(s.perfect.length, prev.perfect.length)} previousYear={prev.year} />
                    <Kpi
                        label="Nota media"
                        value={s.averageRating !== null ? decimal(s.averageRating) : '—'}
                        diff={delta(s.averageRating, prev.averageRating)}
                        previousYear={prev.year}
                    />
                </dl>
                <p className="stats-note">
                    {s.hoursMeasured
                        ? 'Horas medidas con la foto diaria de tu biblioteca.'
                        : `Horas aproximadas: las de cada juego se reparten entre los años en que desbloqueaste sus logros (o el de la última partida si no tiene).${
                              s.measuredMinutes > 0 ? ` Medidas desde que se guarda tu historial: ${formatHours(s.measuredMinutes)}.` : ''
                          }`}
                </p>
            </div>

            <div className="stats-grid">
                <Panel id="stats-months" title="Logros por mes" hint={`${NUMBER.format(s.unlocks)} en ${s.year}`} wide>
                    {s.unlocks === 0 ? (
                        <p className="stats-empty">Ningún logro desbloqueado en {s.year}.</p>
                    ) : (
                        <Columns
                            values={s.unlocksByMonth}
                            labels={MONTH_SHORT}
                            describe={(v, m) => `${m}: ${NUMBER.format(v)} ${v === 1 ? 'logro' : 'logros'}`}
                        />
                    )}
                </Panel>

                <Panel id="stats-completed" title="Completados" hint={`${s.completed.length} en ${s.year}`}>
                    {s.completed.length === 0 ? (
                        <p className="stats-empty">
                            Ningún juego completado en {s.year}. Márcalos como completados desde la{' '}
                            <Link href="/biblioteca">biblioteca</Link> o su ficha.
                        </p>
                    ) : (
                        <ul className="stats-games">
                            {s.completed.map((g) => (
                                <li key={g.appid}>
                                    <span className="stats-games__cover">
                                        <GameCover appid={g.appid} name={g.name} headerImage={g.header_image} variant="header" sizes="96px" />
                                    </span>
                                    <span className="stats-games__name">
                                        <Link href={`/juego/${g.appid}`}>{g.name ?? `App ${g.appid}`}</Link>
                                        <small>{DATE.format(new Date(g.completed_at))}</small>
                                    </span>
                                    <span className="stats-games__rating" title="Tu nota">
                                        {g.rating !== null ? decimal(g.rating) : '—'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>

                <Panel id="stats-ratings" title="Notas" hint={s.averageRating !== null ? `Media ${decimal(s.averageRating)}` : undefined}>
                    {s.ratingHistogram.every((n) => n === 0) ? (
                        <p className="stats-empty">Sin notas en {s.year}: se ponen al completar un juego.</p>
                    ) : (
                        <Columns
                            values={s.ratingHistogram}
                            labels={s.ratingHistogram.map((_, i) => String(i))}
                            describe={(v, n) => `Nota ${n}: ${v} ${v === 1 ? 'juego' : 'juegos'}`}
                        />
                    )}
                </Panel>

                <Panel id="stats-top" title="Lo que más jugaste" hint={s.hoursMeasured ? undefined : 'Horas aproximadas'}>
                    {s.topGames.length === 0 ? (
                        <p className="stats-empty">Sin horas registradas en {s.year}.</p>
                    ) : (
                        <Bars
                            rows={s.topGames.map((g) => ({
                                key: g.appid,
                                label: <Link href={`/juego/${g.appid}`}>{g.name ?? `App ${g.appid}`}</Link>,
                                value: g.minutes,
                                display: formatHours(g.minutes),
                            }))}
                        />
                    )}
                </Panel>

                <Panel id="stats-genres" title="Géneros" hint={`${s.activeGames} juegos con actividad`}>
                    {s.genres.length === 0 ? (
                        <p className="stats-empty">Sin juegos con actividad en {s.year}.</p>
                    ) : (
                        <Bars
                            rows={s.genres.slice(0, 8).map((g) => ({
                                key: g.name,
                                label: <span>{g.name}</span>,
                                value: g.count,
                                display: `${g.count} ${g.count === 1 ? 'juego' : 'juegos'}`,
                            }))}
                        />
                    )}
                </Panel>

                <Panel id="stats-perfect" title="Juegos al 100 %" hint={`Último logro en ${s.year}`} wide>
                    {s.perfect.length === 0 ? (
                        <p className="stats-empty">Ningún juego completado al 100 % en {s.year}.</p>
                    ) : (
                        <ul className="stats-covers">
                            {s.perfect.map((g) => (
                                <li key={g.appid}>
                                    <Link href={`/juego/${g.appid}/logros`} title={g.name ?? undefined} aria-label={`Logros de ${g.name ?? `App ${g.appid}`}`}>
                                        <GameCover appid={g.appid} name={g.name} headerImage={g.header_image} variant="header" sizes="160px" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                    {s.rarest && (
                        <div className="stats-rarest">
                            <p className="stats-rarest__title">Tu logro más raro del año</p>
                            <div className="hg-ach" style={rarestTier ? ({ '--c': rarityColor(rarestTier) } as CSSVars) : undefined}>
                                <span className="hg-ach__icon">
                                    {s.rarest.icon ? (
                                        // eslint-disable-next-line @next/next/no-img-element -- icono del CDN de Steam
                                        <img src={s.rarest.icon} alt="" width={32} height={32} />
                                    ) : (
                                        <Trophy size={18} aria-hidden />
                                    )}
                                </span>
                                <span className="hg-ach__body">
                                    <span className="hg-ach__name">{s.rarest.display_name ?? 'Logro'}</span>
                                    {rarestGame && (
                                        <span className="hg-ach__game">
                                            <Link href={`/juego/${s.rarest.appid}/logros`}>{rarestGame}</Link>
                                        </span>
                                    )}
                                </span>
                                <span className="hg-ach__pct">
                                    {formatPercent(s.rarest.global_percent)}
                                    <span className="sr-only"> de los jugadores</span>
                                    {rarestTier && <small>{RARITY_TIER_LABELS[rarestTier]}</small>}
                                </span>
                            </div>
                        </div>
                    )}
                </Panel>
            </div>
        </>
    )
}

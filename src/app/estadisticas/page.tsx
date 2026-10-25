import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Award, BarChart3, CalendarDays, Clock, Gamepad2, Sparkles, Star, Tags, Trophy } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { loadStatsInput } from '@/lib/stats-db'
import { MONTH_SHORT, approxMinutesByYear, availableYears, delta, madridYear, yearStats, type YearStats } from '@/lib/stats'
import { formatHours } from '@/lib/format'
import { formatPercent } from '@/lib/achievements'

import { Reveal } from '@/components/motion'
import GameCover from '@/components/tracker/GameCover'
import './stats.css'

export const metadata: Metadata = {
    title: 'Estadísticas',
    description: 'Tu año en juegos: completados, horas, notas, géneros y logros por mes.',
}

export const dynamic = 'force-dynamic'

const DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' })
const NUMBER = new Intl.NumberFormat('es-ES')

function decimal(n: number): string {
    return String(n).replace('.', ',')
}

function Panel({ id, icon: Icon, title, hint, children, wide }: { id: string; icon: typeof Trophy; title: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
    return (
        <section className={`stats-panel glass${wide ? ' stats-panel--wide' : ''}`} aria-labelledby={id}>
            <header className="stats-panel__head">
                <h2 id={id} className="stats-panel__title">
                    <Icon size={16} aria-hidden /> {title}
                </h2>
                {hint && <p className="stats-panel__hint">{hint}</p>}
            </header>
            {children}
        </section>
    )
}

/** Cifra del año con la diferencia respecto al anterior. */
function Kpi({ label, value, diff, unit, previousYear }: { label: string; value: string; diff: number | null; unit?: string; previousYear: number }) {
    const sign = diff === null || diff === 0 ? 'same' : diff > 0 ? 'up' : 'down'
    return (
        <div className="stats-kpi">
            <dt>{label}</dt>
            <dd>{value}</dd>
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

/**
 * Barras verticales de una serie (logros por mes, notas). Sin librería: cada barra es un elemento con su valor en el
 * tooltip (title) y en aria-label; el máximo lleva etiqueta directa.
 */
function Columns({ values, labels, describe }: { values: number[]; labels: string[]; describe: (value: number, label: string) => string }) {
    const max = Math.max(...values, 0)
    return (
        <ol className="stats-cols" style={{ ['--n' as string]: values.length }}>
            {values.map((v, i) => (
                <li key={labels[i]} className="stats-cols__item" title={describe(v, labels[i])} aria-label={describe(v, labels[i])}>
                    <span className="stats-cols__track">
                        {v > 0 && (
                            <span className="stats-cols__bar" style={{ height: `${(v / max) * 100}%` }}>
                                {v === max && <span className="stats-cols__value">{NUMBER.format(v)}</span>}
                            </span>
                        )}
                    </span>
                    <span className="stats-cols__label">{labels[i]}</span>
                </li>
            ))}
        </ol>
    )
}

function YearView({ s, prev }: { s: YearStats; prev: YearStats }) {
    const hours = `${s.hoursMeasured ? '' : '≈ '}${formatHours(s.minutes)}`
    const maxGenre = s.genres[0]?.count ?? 0
    return (
        <>
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

            <div className="stats-grid">
                <Panel id="stats-months" icon={Award} title="Logros por mes" hint={`${NUMBER.format(s.unlocks)} en ${s.year}`} wide>
                    {s.unlocks === 0 ? (
                        <p className="stats-empty">Ningún logro desbloqueado en {s.year}.</p>
                    ) : (
                        <Columns
                            values={s.unlocksByMonth}
                            labels={MONTH_SHORT}
                            describe={(v, m) => `${m}: ${v} ${v === 1 ? 'logro' : 'logros'}`}
                        />
                    )}
                </Panel>

                <Panel id="stats-completed" icon={Trophy} title="Completados" hint={`${s.completed.length} en ${s.year}`}>
                    {s.completed.length === 0 ? (
                        <p className="stats-empty">
                            Ningún juego completado en {s.year}. Márcalos como completados desde la{' '}
                            <Link href="/biblioteca">biblioteca</Link> o su ficha.
                        </p>
                    ) : (
                        <ul className="stats-games">
                            {s.completed.map((g) => (
                                <li key={g.appid}>
                                    <Link href={`/juego/${g.appid}`} className="stats-games__cover">
                                        <GameCover appid={g.appid} name={g.name} headerImage={g.header_image} variant="header" sizes="120px" />
                                    </Link>
                                    <span className="stats-games__name">
                                        <Link href={`/juego/${g.appid}`}>{g.name ?? `App ${g.appid}`}</Link>
                                        <small>{DATE.format(new Date(g.completed_at))}</small>
                                    </span>
                                    <span className="stats-games__rating">{g.rating !== null ? decimal(g.rating) : '—'}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>

                <Panel id="stats-ratings" icon={Star} title="Notas" hint={s.averageRating !== null ? `Media ${decimal(s.averageRating)}` : undefined}>
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

                <Panel id="stats-top" icon={Clock} title="Lo que más jugaste" hint={s.hoursMeasured ? undefined : 'Horas aproximadas'}>
                    {s.topGames.length === 0 ? (
                        <p className="stats-empty">Sin horas registradas en {s.year}.</p>
                    ) : (
                        <ol className="stats-bars">
                            {s.topGames.map((g) => (
                                <li key={g.appid} title={`${g.name ?? g.appid}: ${formatHours(g.minutes)}`}>
                                    <span className="stats-bars__label">
                                        <Link href={`/juego/${g.appid}`}>{g.name ?? `App ${g.appid}`}</Link>
                                        <span>{formatHours(g.minutes)}</span>
                                    </span>
                                    <span className="stats-bars__track">
                                        <span className="stats-bars__bar" style={{ width: `${(g.minutes / s.topGames[0].minutes) * 100}%` }} />
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}
                </Panel>

                <Panel id="stats-genres" icon={Tags} title="Géneros" hint={`${s.activeGames} juegos con actividad`}>
                    {s.genres.length === 0 ? (
                        <p className="stats-empty">Sin juegos con actividad en {s.year}.</p>
                    ) : (
                        <ol className="stats-bars">
                            {s.genres.slice(0, 8).map((g) => (
                                <li key={g.name} title={`${g.name}: ${g.count} ${g.count === 1 ? 'juego' : 'juegos'}`}>
                                    <span className="stats-bars__label">
                                        <span>{g.name}</span>
                                        <span>{g.count}</span>
                                    </span>
                                    <span className="stats-bars__track">
                                        <span className="stats-bars__bar" style={{ width: `${(g.count / maxGenre) * 100}%` }} />
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}
                </Panel>

                <Panel id="stats-perfect" icon={Sparkles} title="Juegos al 100 %" hint={`Último logro en ${s.year}`}>
                    {s.perfect.length === 0 ? (
                        <p className="stats-empty">Ningún juego completado al 100 % en {s.year}.</p>
                    ) : (
                        <ul className="stats-covers">
                            {s.perfect.map((g) => (
                                <li key={g.appid}>
                                    <Link href={`/juego/${g.appid}/logros`} title={g.name ?? undefined}>
                                        <GameCover appid={g.appid} name={g.name} headerImage={g.header_image} variant="vertical" sizes="96px" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                    {s.rarest && (
                        <p className="stats-rarest">
                            Tu logro más raro del año: <strong>{s.rarest.display_name ?? 'Logro'}</strong> ({formatPercent(s.rarest.global_percent)} de
                            los jugadores).
                        </p>
                    )}
                </Panel>
            </div>
        </>
    )
}

/** Estadísticas por año (#32). Se calculan en el servidor con tus datos sincronizados. */
export default async function EstadisticasPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
    const supabase = await createServerClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const input = await loadStatsInput(supabase, user.id)
    const years = availableYears(input)
    const requested = Number((await searchParams).year)
    const year = years.includes(requested) ? requested : madridYear(new Date().toISOString())
    const approx = approxMinutesByYear(input.games, input.unlocks)
    const stats = yearStats(input, year, approx)
    const prev = yearStats(input, year - 1, approx)

    return (
        <div className="stats">
            <header className="page-head">
                <div>
                    <Reveal>
                        <span className="eyebrow">
                            <BarChart3 size={13} aria-hidden /> Estadísticas
                        </span>
                    </Reveal>
                    <Reveal delay={0.05}>
                        <h1 className="page-title">Tu {year} en juegos</h1>
                    </Reveal>
                    <Reveal delay={0.1}>
                        <p className="page-subtitle">
                            {stats.activeGames > 0
                                ? `${stats.activeGames} ${stats.activeGames === 1 ? 'juego' : 'juegos'} con actividad, comparado con ${year - 1}.`
                                : `Sin actividad registrada en ${year}.`}
                        </p>
                    </Reveal>
                </div>
            </header>

            <nav className="stats-years" aria-label="Año">
                <CalendarDays size={14} aria-hidden />
                {years.map((y) => (
                    <Link key={y} href={`/estadisticas?year=${y}`} className={`stats-year${y === year ? ' is-active' : ''}`} aria-current={y === year ? 'page' : undefined}>
                        {y}
                    </Link>
                ))}
            </nav>

            {input.games.length === 0 ? (
                <p className="stats-empty glass stats-empty--box">
                    <Gamepad2 size={18} aria-hidden /> Conecta Steam desde tu <Link href="/perfil">perfil</Link> para ver tus estadísticas.
                </p>
            ) : (
                <YearView s={stats} prev={prev} />
            )}
        </div>
    )
}

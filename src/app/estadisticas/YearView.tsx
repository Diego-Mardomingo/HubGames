'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useInView, useReducedMotion } from 'framer-motion'
import {
    ArrowDown,
    ArrowUp,
    Award,
    ChartColumn,
    ChevronDown,
    Clock,
    Equal,
    Flag,
    Info,
    Library,
    Play,
    Sparkles,
    Star,
    Table,
    Tag,
    Trophy,
} from 'lucide-react'
import type { YearSummary, YearView as YearData } from '@/lib/stats-year'
import { summaryDiff } from '@/lib/stats-year'
import { ratingBucket } from '@/lib/stats'
import { formatHours } from '@/lib/format'
import { RARITY_TIERS, RARITY_TIER_LABELS, rarityColor, type RarityTier } from '@/lib/rarity'
import { RATING_LABELS, ratingTier, type ScoreTier } from '@/lib/scores'
import { STATUS_LABELS } from '@/lib/tracker'
import { Button } from '@/components/ui/button'
import CountUp from '@/components/CountUp'
import Segmented from '@/components/Segmented'
import Tile from '@/components/Tile'
import AchievementItem from '@/components/achievements/AchievementItem'
import SyncButton from '@/components/dashboard/SyncButton'
import EmptyState from '@/components/EmptyState'
import GameCover from '@/components/tracker/GameCover'
import { MarkFlags, StatusChip } from '@/components/tracker/status'
import Columns from './Columns'

type CSSVars = CSSProperties & Record<`--${string}`, string | number>

const NUMBER = new Intl.NumberFormat('es-ES')
const DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' })
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
const MONTH_LETTER = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const SCORE_TIERS: ScoreTier[] = ['top', 'good', 'mid', 'bad']
/** Completados a la vista antes de «Ver N más». */
const DONE_STEP = 6

const decimal = (n: number) => String(n).replace('.', ',')
const capital = (s: string) => s[0].toUpperCase() + s.slice(1)
const plural = (n: number, one: string, many: string) => `${NUMBER.format(n)} ${n === 1 ? one : many}`
const percent = (v: number, total: number) => `${Math.round((v / total) * 100)} %`

/** Panel que entra una vez al llegar con el scroll; hasta entonces sus animaciones (columnas, barras, sellos) esperan. */
function Panel({ id, tone, icon, title, count, end, wide, children }: { id: string; tone: string; icon: ReactNode; title: string; count?: string; end?: ReactNode; wide?: boolean; children: ReactNode }) {
    const ref = useRef<HTMLElement>(null)
    const inView = useInView(ref, { once: true, amount: 0.15 })
    const reduce = useReducedMotion()
    return (
        <section ref={ref} className={['dash-panel st-panel', wide && 'st-panel--wide', (inView || reduce) && 'is-in'].filter(Boolean).join(' ')} aria-labelledby={id}>
            <header className="dash-sec__head">
                <span className={`dash-sec__icon hg-tint ${tone}`} aria-hidden>
                    {icon}
                </span>
                <h2 id={id} className="dash-sec__title">
                    {title}
                </h2>
                {count && <span className="dash-sec__count">{count}</span>}
                {end && <span className="dash-sec__end">{end}</span>}
            </header>
            {children}
        </section>
    )
}

/** Diferencia con el año anterior, en gris con flecha: subir o bajar no es ni bueno ni malo. */
function Diff({ value, previousYear, unit = '' }: { value: number | null; previousYear: number; unit?: string }) {
    if (value === null) return <dd className="hg-tile__note">Sin datos de {previousYear}</dd>
    if (value === 0)
        return (
            <dd className="hg-tile__note st-diff">
                <Equal aria-hidden />
                Igual que en {previousYear}
            </dd>
        )
    const Icon = value > 0 ? ArrowUp : ArrowDown
    return (
        <dd className="hg-tile__note st-diff">
            <Icon aria-hidden />
            {value > 0 ? '+' : '−'}
            {decimal(Math.abs(value))}
            {unit} vs {previousYear}
        </dd>
    )
}

function Tiles({ v, prev, from }: { v: YearData; prev: YearSummary | null; from: YearSummary | null }) {
    const s = v.summary
    const diff = summaryDiff(s, prev)
    const py = v.year - 1
    const avgTier = s.averageRating !== null ? ratingTier(s.averageRating) : null
    const enter = (i: number): CSSVars => ({ '--i': i })
    return (
        <dl className="hg-tiles st-tiles">
            <div className="hg-enter" style={enter(0)}>
                <Tile icon={<Flag aria-hidden />} tone="st-completado" label="Completados">
                    <dd className="hg-tile__value">
                        <CountUp value={s.completed} from={from?.completed} />
                    </dd>
                    <Diff value={diff.completed} previousYear={py} />
                </Tile>
            </div>
            <div className="hg-enter" style={enter(1)}>
                <Tile icon={<Clock aria-hidden />} tone="st-jugando" label={v.hoursMeasured ? 'Horas jugadas' : 'Horas (aprox.)'}>
                    <dd className="hg-tile__value">
                        {!v.hoursMeasured && s.hours > 0 && '≈ '}
                        <CountUp value={s.hours} from={from?.hours} suffix="h" />
                    </dd>
                    <Diff value={diff.hours} previousYear={py} unit=" h" />
                </Tile>
            </div>
            <div className="hg-enter" style={enter(2)}>
                <Tile icon={<Award aria-hidden />} tone="st-sin_final" label="Logros">
                    <dd className="hg-tile__value">
                        <CountUp value={s.unlocks} from={from?.unlocks} />
                    </dd>
                    <Diff value={diff.unlocks} previousYear={py} />
                </Tile>
            </div>
            <div className="hg-enter" style={enter(3)}>
                <Tile icon={<Trophy aria-hidden />} tone="st-completado" label="Juegos al 100 %">
                    <dd className="hg-tile__value">
                        <CountUp value={s.perfect} from={from?.perfect} />
                    </dd>
                    <Diff value={diff.perfect} previousYear={py} />
                </Tile>
            </div>
            <div className="hg-enter" style={enter(4)}>
                <Tile icon={<Star aria-hidden />} tone={avgTier ? `sc-${avgTier}` : 'st-neutral'} label="Nota media">
                    <dd className="hg-tile__value">
                        {s.averageRating !== null && avgTier ? (
                            <>
                                <CountUp value={s.averageRating} decimals={1} from={from?.averageRating ?? undefined} />
                                <span className="st-tile__word">{RATING_LABELS[avgTier]}</span>
                            </>
                        ) : (
                            <small>—</small>
                        )}
                    </dd>
                    <Diff value={diff.averageRating} previousYear={py} />
                </Tile>
            </div>
        </dl>
    )
}

/** Fila de leyenda o de tooltip con la muestra de color de su rareza. */
function rarityStyle(tier: RarityTier): CSSVars {
    return { '--c': rarityColor(tier) }
}

function MonthsPanel({ v }: { v: YearData }) {
    const [table, setTable] = useState(false)
    const total = v.rarity.total
    const toggle = (
        <Button type="button" variant="ghost" size="sm" aria-pressed={table} onClick={() => setTable((t) => !t)}>
            {table ? <ChartColumn aria-hidden /> : <Table aria-hidden />}
            {table ? 'Ver gráfico' : 'Ver tabla'}
        </Button>
    )
    const tiers = RARITY_TIERS.filter((t) => v.rarity.tiers[t] > 0)
    return (
        <Panel id="st-months" tone="st-sin_final" icon={<Award />} title="Logros por mes" count={`${NUMBER.format(total)} en ${v.year}`} end={total > 0 && toggle} wide>
            {total === 0 ? (
                <p className="st-empty">Ningún logro desbloqueado en {v.year}.</p>
            ) : table ? (
                <div className="st-table-wrap st-swap">
                    <table className="st-table">
                        <caption className="sr-only">
                            Logros por mes y rareza en {v.year}
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col">Mes</th>
                                <th scope="col">Total</th>
                                {RARITY_TIERS.map((t) => (
                                    <th key={t} scope="col">
                                        <span className="st-sw" style={rarityStyle(t)} />
                                        {RARITY_TIER_LABELS[t]}
                                    </th>
                                ))}
                                {v.rarity.unknown > 0 && <th scope="col">Sin dato</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {v.months.map((m, i) => (
                                <tr key={i}>
                                    <th scope="row">{capital(MONTHS[i])}</th>
                                    <td>{m ? NUMBER.format(m.total) : '—'}</td>
                                    {RARITY_TIERS.map((t) => (
                                        <td key={t}>{m ? NUMBER.format(m.tiers[t]) : '—'}</td>
                                    ))}
                                    {v.rarity.unknown > 0 && <td>{m ? NUMBER.format(m.unknown) : '—'}</td>}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th scope="row">{v.year}</th>
                                <td>{NUMBER.format(total)}</td>
                                {RARITY_TIERS.map((t) => (
                                    <td key={t}>{NUMBER.format(v.rarity.tiers[t])}</td>
                                ))}
                                {v.rarity.unknown > 0 && <td>{NUMBER.format(v.rarity.unknown)}</td>}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            ) : (
                <div className="st-swap">
                    {tiers.length > 0 && (
                        <div className="st-rarity">
                            <div className="lg-stack st-stack" role="img" aria-label={`Reparto de ${v.year} por rareza: ${tiers.map((t) => `${RARITY_TIER_LABELS[t]} ${v.rarity.tiers[t]}`).join(', ')}`}>
                                {tiers.map((t) => (
                                    <span key={t} style={{ flex: v.rarity.tiers[t], ...rarityStyle(t) }} />
                                ))}
                            </div>
                            <ul className="st-legend">
                                {RARITY_TIERS.map((t) => (
                                    <li key={t}>
                                        <span className="st-sw" style={rarityStyle(t)} />
                                        {RARITY_TIER_LABELS[t]} <b>{NUMBER.format(v.rarity.tiers[t])}</b>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <Columns
                        columns={v.months.map((m, i) => ({
                            value: m ? m.total : null,
                            label: MONTH_SHORT[i],
                            short: MONTH_LETTER[i],
                            aria: m ? `${capital(MONTHS[i])}: ${plural(m.total, 'logro', 'logros')}` : `${capital(MONTHS[i])}: aún no ha llegado`,
                        }))}
                        tip={(i) => {
                            const m = v.months[i]
                            const when = `${capital(MONTHS[i])} de ${v.year}`
                            if (!m)
                                return (
                                    <>
                                        <span className="st-tip__v">Aún no</span>
                                        <span className="st-tip__k">{when}</span>
                                    </>
                                )
                            return (
                                <>
                                    <span className="st-tip__v">{plural(m.total, 'logro', 'logros')}</span>
                                    <span className="st-tip__k">{when}</span>
                                    {[...RARITY_TIERS].reverse().map(
                                        (t) =>
                                            m.tiers[t] > 0 && (
                                                <span key={t} className="st-tip__row" style={rarityStyle(t)}>
                                                    {RARITY_TIER_LABELS[t]}
                                                    <b>{NUMBER.format(m.tiers[t])}</b>
                                                </span>
                                            ),
                                    )}
                                    {m.unknown > 0 && (
                                        <span className="st-tip__row st-tip__row--none">
                                            Sin dato<b>{NUMBER.format(m.unknown)}</b>
                                        </span>
                                    )}
                                </>
                            )
                        }}
                    />
                </div>
            )}
        </Panel>
    )
}

function ListsPanel({ v }: { v: YearData }) {
    const [hot, setHot] = useState<string | null>(null)
    const total = v.lists.reduce((s, l) => s + l.count, 0)
    const max = Math.max(...v.lists.map((l) => l.count), 0)
    return (
        <Panel id="st-lists" tone="" icon={<Library />} title="Tus listas" count={`${plural(total, 'juego', 'juegos')} con actividad`}>
            {total === 0 ? (
                <p className="st-empty">Sin juegos con actividad en {v.year}.</p>
            ) : (
                <div>
                    <div className={`lg-stack st-stack st-stack--lists${hot ? ' is-hot' : ''}`} role="img" aria-label={`Reparto por lista: ${v.lists.map((l) => `${STATUS_LABELS[l.status]} ${l.count}`).join(', ')}`}>
                        {v.lists.map((l) => (
                            <span key={l.status} className={`st-${l.status}${hot === l.status ? ' is-hot' : ''}`} style={{ flex: l.count }} />
                        ))}
                    </div>
                    <ul className="st-lrows">
                        {v.lists.map((l, i) => (
                            <li
                                key={l.status}
                                className={`st-lrow st-${l.status}`}
                                onPointerEnter={() => setHot(l.status)}
                                onPointerLeave={() => setHot(null)}
                                onFocus={() => setHot(l.status)}
                                onBlur={() => setHot(null)}
                            >
                                <Link href={l.status === 'bandeja' ? '/biblioteca/bandeja' : `/biblioteca?estado=${l.status}`} aria-label={`${STATUS_LABELS[l.status]}: ${plural(l.count, 'juego', 'juegos')}`}>
                                    <StatusChip status={l.status} />
                                </Link>
                                <span className="hg-bar hg-bar--fill st-lrow__bar" aria-hidden>
                                    <span style={{ width: `${(l.count / max) * 100}%`, '--i': i } as CSSVars} />
                                </span>
                                <span className="st-lrow__n">
                                    {NUMBER.format(l.count)}
                                    <small>{percent(l.count, total)}</small>
                                </span>
                            </li>
                        ))}
                    </ul>
                    <p className="st-foot">Según la lista en la que está hoy cada juego.</p>
                </div>
            )}
        </Panel>
    )
}

function NotesPanel({ v }: { v: YearData }) {
    const avg = v.summary.averageRating
    const rated = v.completed.filter((g) => g.rating !== null)
    return (
        <Panel id="st-notes" tone={avg !== null ? `sc-${ratingTier(avg)}` : ''} icon={<Star />} title="Notas" count={avg !== null ? `Media ${decimal(avg)}` : undefined}>
            {rated.length === 0 ? (
                <p className="st-empty">Sin notas en {v.year}: se ponen al completar un juego.</p>
            ) : (
                <div>
                    <Columns
                        height={150}
                        columns={v.ratingHistogram.map((n, i) => ({
                            value: n,
                            label: String(i),
                            tone: `sc-${ratingTier(i)}`,
                            aria: `Nota ${i}: ${plural(n, 'juego', 'juegos')}`,
                        }))}
                        tip={(i) => {
                            const tier = ratingTier(i)
                            const games = rated.filter((g) => ratingBucket(g.rating!) === i)
                            return (
                                <>
                                    <span className="st-tip__v">{plural(games.length, 'juego', 'juegos')}</span>
                                    <span className="st-tip__k">
                                        Nota {i} · {RATING_LABELS[tier]}
                                    </span>
                                    {games.slice(0, 6).map((g) => (
                                        <span key={g.appid} className={`st-tip__row sc-${tier}`}>
                                            <span className="st-tip__name">{g.name ?? `App ${g.appid}`}</span>
                                            <b>{decimal(g.rating!)}</b>
                                        </span>
                                    ))}
                                    {games.length > 6 && <span className="st-tip__k">y {games.length - 6} más</span>}
                                </>
                            )
                        }}
                    />
                    <div className="st-notes-sum">
                        {SCORE_TIERS.map(
                            (t) =>
                                v.ratingTiers[t] > 0 && (
                                    <span key={t} className={`hg-chip hg-tint sc-${t}`}>
                                        {v.ratingTiers[t]} {RATING_LABELS[t]}
                                    </span>
                                ),
                        )}
                    </div>
                </div>
            )}
        </Panel>
    )
}

function CompletedPanel({ v }: { v: YearData }) {
    const [all, setAll] = useState(false)
    const list = all ? v.completed : v.completed.slice(0, DONE_STEP)
    const rest = v.completed.length - DONE_STEP
    return (
        <Panel id="st-done" tone="st-completado" icon={<Flag />} title="Completados" count={`${v.completed.length} en ${v.year}`}>
            {v.completed.length === 0 ? (
                <p className="st-empty">
                    Ningún juego completado en {v.year}. Márcalos como completados desde la <Link href="/biblioteca">biblioteca</Link> o su ficha.
                </p>
            ) : (
                <>
                    <ul className="st-done">
                        {list.map((g, i) => {
                            const tier = g.rating !== null ? ratingTier(g.rating) : null
                            return (
                                <li key={g.appid} className={i >= DONE_STEP ? 'hg-enter' : undefined} style={i >= DONE_STEP ? ({ '--i': i - DONE_STEP } as CSSVars) : undefined}>
                                    <span className="st-cover">
                                        <GameCover appid={g.appid} name={g.name} headerImage={g.header_image} variant="header" sizes="72px" />
                                    </span>
                                    <span className="st-done__main">
                                        <span className="st-done__name">
                                            <Link href={`/juego/${g.appid}`}>{g.name ?? `App ${g.appid}`}</Link>
                                            <MarkFlags favorite={g.favorite} endless={false} />
                                        </span>
                                        <span className="st-done__meta">
                                            {DATE.format(new Date(g.completed_at))}
                                            {g.minutes > 0 && ` · ${formatHours(g.minutes)}`}
                                        </span>
                                    </span>
                                    {tier ? (
                                        <span className={`hg-score hg-tint sc-${tier} st-score`} title="Tu nota">
                                            {decimal(g.rating!)}
                                            <small>{RATING_LABELS[tier]}</small>
                                        </span>
                                    ) : (
                                        <span className="st-done__none" title="Sin nota">
                                            —
                                        </span>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                    {rest > 0 && !all && (
                        <Button type="button" variant="ghost" size="sm" className="st-more" onClick={() => setAll(true)}>
                            <ChevronDown aria-hidden />
                            Ver {rest} más
                        </Button>
                    )}
                </>
            )}
        </Panel>
    )
}

function TopPanel({ v }: { v: YearData }) {
    const max = v.top[0]?.minutes ?? 0
    return (
        <Panel id="st-top" tone="st-jugando" icon={<Play />} title="Lo que más jugaste" count={v.hoursMeasured ? undefined : 'Horas aproximadas'}>
            {v.top.length === 0 ? (
                <p className="st-empty">Sin horas registradas en {v.year}.</p>
            ) : (
                <ol className="st-hbars">
                    {v.top.map((g, i) => (
                        <li key={g.appid}>
                            <span className="st-hbars__label">
                                <span className="st-cover st-cover--sm">
                                    <GameCover appid={g.appid} name={g.name} headerImage={g.header_image} variant="header" sizes="46px" />
                                </span>
                                <Link href={`/juego/${g.appid}`} className="st-hbars__name" title={g.name ?? undefined}>
                                    {g.name ?? `App ${g.appid}`}
                                </Link>
                                {g.status && (
                                    <span className="st-hbars__chip">
                                        <StatusChip status={g.status} />
                                    </span>
                                )}
                                <span className="st-hbars__v">{formatHours(g.minutes)}</span>
                            </span>
                            <span className="hg-bar hg-bar--fill st-hbar" aria-hidden>
                                <span style={{ width: `${(g.minutes / max) * 100}%`, '--i': i } as CSSVars} />
                            </span>
                        </li>
                    ))}
                </ol>
            )}
        </Panel>
    )
}

function GenresPanel({ v }: { v: YearData }) {
    const max = v.genres[0]?.count ?? 0
    return (
        <Panel id="st-genres" tone="" icon={<Tag />} title="Géneros" count={`${plural(v.activeGames, 'juego', 'juegos')} con actividad`}>
            {v.genres.length === 0 ? (
                <p className="st-empty">Sin juegos con actividad en {v.year}.</p>
            ) : (
                <ol className="st-hbars">
                    {v.genres.map((g, i) => (
                        <li key={g.name}>
                            <span className="st-hbars__label">
                                <span className="st-hbars__name">{g.name}</span>
                                <span className="st-hbars__v">{plural(g.count, 'juego', 'juegos')}</span>
                            </span>
                            <span className="hg-bar hg-bar--fill st-hbar" aria-hidden>
                                <span style={{ width: `${(g.count / max) * 100}%`, '--i': i } as CSSVars} />
                            </span>
                        </li>
                    ))}
                </ol>
            )}
        </Panel>
    )
}

function PerfectPanel({ v }: { v: YearData }) {
    const r = v.rarest
    return (
        <Panel id="st-perfect" tone="st-completado" icon={<Trophy />} title="Juegos al 100 %" count={`Último logro en ${v.year}`}>
            {v.perfect.length === 0 ? (
                <p className="st-empty">Ningún juego completado al 100 % en {v.year}.</p>
            ) : (
                <ul className="st-covers">
                    {v.perfect.map((g, i) => (
                        <li key={g.appid}>
                            <Link href={`/juego/${g.appid}/logros`} title={g.name ?? undefined} aria-label={`Logros de ${g.name ?? `App ${g.appid}`}`}>
                                <GameCover appid={g.appid} name={g.name} headerImage={g.header_image} variant="header" sizes="160px" />
                                <span className="st-seal hg-pop-in" style={{ '--i': i } as CSSVars} aria-hidden>
                                    100 %
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            {r && (
                <div className="st-rarest">
                    <p className="st-rarest__title">Tu logro más raro del año</p>
                    <ul className="hg-achs">
                        <AchievementItem
                            achievement={{
                                appid: r.appid,
                                apiname: r.display_name ?? 'rarest',
                                achieved: true,
                                hidden: false,
                                unlocktime: r.unlocktime,
                                display_name: r.display_name,
                                description: r.description,
                                icon: r.icon,
                                icongray: null,
                                global_percent: r.global_percent,
                            }}
                            gameName={r.game ?? ''}
                            context={r.game ? <Link href={`/juego/${r.appid}/logros`}>{r.game}</Link> : undefined}
                            index={0}
                        />
                    </ul>
                </div>
            )}
        </Panel>
    )
}

function Body({ v, prev, from, swapped }: { v: YearData; prev: YearSummary | null; from: YearSummary | null; swapped: boolean }) {
    const empty = v.activeGames === 0 && v.summary.unlocks === 0 && v.summary.completed === 0
    return (
        <div className={`st-body${swapped ? ' st-swap' : ''}`}>
            <Tiles v={v} prev={prev} from={from} />
            {empty ? (
                <EmptyState
                    tone="st-jugando"
                    icon={<ChartColumn />}
                    title={`Aún no hay actividad en ${v.year}`}
                    className="hg-enter"
                    style={{ '--i': 5 } as CSSVars}
                    action={<SyncButton label="Sincronizar con Steam" variant="secondary" />}
                >
                    Cuando juegues, consigas logros o completes un juego, tu año aparecerá aquí.
                </EmptyState>
            ) : (
                <>
                    {v.summary.hours > 0 && (
                        <p className="st-hours-note">
                            <Info aria-hidden />
                            <span>
                                {v.hoursMeasured
                                    ? 'Horas medidas con la foto diaria de tu biblioteca.'
                                    : `Horas aproximadas: las de cada juego se reparten entre los años en que desbloqueaste sus logros (o el de la última partida si no tiene).${
                                          v.measuredMinutes > 0 ? ` Medidas desde que se guarda tu historial: ${formatHours(v.measuredMinutes)}.` : ''
                                      }`}
                            </span>
                        </p>
                    )}
                    <div className="st-grid">
                        <MonthsPanel v={v} />
                        <ListsPanel v={v} />
                        <NotesPanel v={v} />
                        <CompletedPanel v={v} />
                        <TopPanel v={v} />
                        <GenresPanel v={v} />
                        <PerfectPanel v={v} />
                    </div>
                </>
            )}
        </div>
    )
}

/**
 * /estadisticas en el cliente: todos los años vienen ya calculados del servidor, así que cambiar de año no espera a la
 * red. El segmentado desliza su fondo, el año que se va se funde (120 ms), entra el nuevo (220 ms) y sus cifras cuentan
 * desde las del año anterior; las columnas y barras vuelven a crecer. La URL (?year=) se actualiza con pushState, así
 * que atrás y adelante también cambian de año.
 */
export default function StatsView({ views, initialYear }: { views: YearData[]; initialYear: number }) {
    const byYear = new Map(views.map((v) => [v.year, v]))
    const years = views.map((v) => v.year)
    const params = useSearchParams()
    const asked = Number(params.get('year'))
    const target = byYear.has(asked) ? asked : initialYear
    const reduce = useReducedMotion()

    const [requested, setRequested] = useState(target)
    const [shown, setShown] = useState(target)
    const [out, setOut] = useState(false)
    const [from, setFrom] = useState<YearSummary | null>(null)
    if (target !== requested) {
        setRequested(target)
        setOut(true)
    }

    useEffect(() => {
        if (requested === shown) return
        const id = window.setTimeout(
            () => {
                setFrom(byYear.get(shown)?.summary ?? null)
                setShown(requested)
                setOut(false)
            },
            reduce ? 0 : 120,
        )
        return () => window.clearTimeout(id)
        // byYear se recrea en cada render, pero sus datos no cambian.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requested, shown, reduce])

    const v = byYear.get(shown)!
    const empty = v.activeGames === 0 && v.summary.unlocks === 0 && v.summary.completed === 0
    const prev = byYear.get(shown - 1)?.summary ?? null

    return (
        <div className="stats">
            <header className="page-head">
                <div>
                    <h1 className="page-title">Tu {shown} en juegos</h1>
                    <p className="page-subtitle">
                        {v.activeGames > 0 ? `${plural(v.activeGames, 'juego', 'juegos')} con actividad, comparado con ${shown - 1}.` : `Sin actividad registrada en ${shown}.`}
                    </p>
                </div>
                {!empty && (
                    <Button asChild>
                        <Link href={`/estadisticas/resumen?year=${shown}`}>
                            <Sparkles aria-hidden />
                            Ver tu resumen de {shown}
                        </Link>
                    </Button>
                )}
            </header>

            {years.length > 1 && (
                <Segmented
                    value={String(requested)}
                    options={years.map(String)}
                    labels={Object.fromEntries(years.map((y) => [String(y), String(y)]))}
                    onChange={(y) => window.history.pushState(null, '', `?year=${y}`)}
                    scroll
                    className="st-years"
                    aria-label="Año"
                />
            )}

            <div className={`st-stage${out ? ' is-out' : ''}`} aria-busy={out}>
                <Body key={shown} v={v} prev={prev} from={from} swapped={from !== null} />
            </div>
        </div>
    )
}

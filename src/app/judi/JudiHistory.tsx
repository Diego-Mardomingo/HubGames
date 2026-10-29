'use client'

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ArrowRight, Award, ChartBar, Check, ChevronDown, CircleDashed, Clock, Flame, History, Layers, Percent, Play, Trophy, X } from 'lucide-react'
import CountUp from '@/components/CountUp'
import Segmented from '@/components/Segmented'
import ActivityHeatmap from '@/components/dashboard/ActivityHeatmap'
import { Button } from '@/components/ui/button'
import { parseDayKey, yearHeatmap } from '@/lib/achievement-history'
import type { HeatDay } from '@/lib/activity-heatmap'
import {
    JUDI_FILTER_LABELS,
    JUDI_FILTERS,
    judiFilterCounts,
    judiMonths,
    judiStats,
    matchesJudiFilter,
    type JudiFilter,
    type JudiStats,
} from '@/lib/judi'
import JudiDayRow, { judiDayLong, judiDayShort, type JudiHistoryDay } from './JudiDayRow'
import EmptyState from '@/components/EmptyState'
import '@/components/dashboard/dashboard.css'

const EASE_OUT = [0.22, 1, 0.36, 1] as const
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const ONE: Record<JudiFilter, string> = { all: 'día', won: 'acertado', lost: 'fallado', progress: 'en curso', new: 'sin jugar' }

/** Tu puesto en el ranking: undefined mientras carga, null si no estás (o eres invitado). */
export type JudiRank = { position: number; total: number } | null | undefined

const FILTER_ICONS: Partial<Record<JudiFilter, ReactNode>> = {
    won: <Check className="jd-f-ic jd-ok" aria-hidden />,
    lost: <X className="jd-f-ic jd-ko" aria-hidden />,
    progress: <Play className="jd-f-ic jd-ac" aria-hidden />,
    new: <CircleDashed className="jd-f-ic" aria-hidden />,
}

function countClass(f: JudiFilter, n: number): string {
    const tone = f === 'won' ? 'hg-tint jd-ok' : f === 'lost' ? 'hg-tint jd-ko' : f === 'progress' ? 'hg-tint st-todos' : ''
    return ['jd-cnt', tone, n ? '' : 'is-zero'].filter(Boolean).join(' ')
}

function plural(n: number, one: string, many: string) {
    return `${n.toLocaleString('es-ES')} ${n === 1 ? one : many}`
}

/** «3–13 de julio», «28 de junio – 2 de julio» o «25 de octubre». */
function dateRange(from: string, to: string): string {
    if (from === to) return judiDayLong(from)
    const [, fm, fd] = from.split('-').map(Number)
    const [, tm, td] = to.split('-').map(Number)
    if (fm === tm && from.slice(0, 4) === to.slice(0, 4)) return `${fd}–${td} de ${MONTHS[tm - 1]}`
    return `${judiDayLong(from)} – ${judiDayLong(to)}`
}

function monthLabel(key: string, currentYear: string): string {
    const [y, m] = key.split('-')
    const name = MONTHS[Number(m) - 1]
    return `${name.charAt(0).toUpperCase()}${name.slice(1)}${y !== currentYear ? ` ${y}` : ''}`
}

function dayWord(day: JudiHistoryDay): string {
    if (day.status === 'won') return day.failed === 0 ? 'acertado a la primera' : `acertado en el intento ${day.failed + 1}`
    if (day.status === 'lost') return 'fallado'
    if (day.status === 'progress') return 'en curso'
    return 'sin jugar'
}

/* ── Cifras ── */

function StatsTiles({
    stats,
    todayStatus,
    rank,
    guest,
    onSpot,
}: {
    stats: JudiStats
    todayStatus: JudiHistoryDay['status'] | null
    rank: JudiRank
    guest: boolean
    onSpot: (spot: 'streak' | 'best' | null) => void
}) {
    const spot = (s: 'streak' | 'best') => ({
        tabIndex: 0,
        onMouseEnter: () => onSpot(s),
        onMouseLeave: () => onSpot(null),
        onFocus: () => onSpot(s),
        onBlur: () => onSpot(null),
    })
    const off = stats.streak === 0
    const finished = stats.wins + stats.losses
    return (
        <dl className="hg-tiles jd-tiles" aria-label="Tus estadísticas de JUDI">
            <div className={`hg-tile jd-streak st-todos is-hoverable hg-enter${off ? ' is-off' : ''}${stats.atRisk ? ' is-risk' : ''}`} style={{ '--i': 1 } as CSSProperties} {...spot('streak')}>
                <dt>
                    <span className="hg-tile__icon hg-tint jd-flame">
                        <Flame aria-hidden />
                    </span>
                    Racha actual
                </dt>
                <dd className="hg-tile__value">
                    <CountUp value={stats.streak} /> <small>{stats.streak === 1 ? 'día' : 'días'}</small>
                </dd>
                <dd className="hg-tile__note">
                    {stats.atRisk ? (
                        <span className="jd-risk">
                            <Clock aria-hidden />
                            Acierta el de hoy para llegar a {stats.streak + 1}
                        </span>
                    ) : off ? (
                        todayStatus === 'lost' ? 'Se cortó hoy. Mañana empiezas otra' : 'Acierta el de hoy para empezar una'
                    ) : (
                        <>
                            Desde el <b>{judiDayLong(stats.streakFrom!)}</b>
                        </>
                    )}
                </dd>
            </div>
            <div className="hg-tile jd-best is-hoverable hg-enter" style={{ '--i': 2 } as CSSProperties} {...spot('best')}>
                <dt>
                    <span className="hg-tile__icon">
                        <Award aria-hidden />
                    </span>
                    Mejor racha
                </dt>
                <dd className="hg-tile__value">
                    <CountUp value={stats.best} /> <small>{stats.best === 1 ? 'día' : 'días'}</small>
                </dd>
                <dd className="hg-tile__note">
                    {stats.best === 0 ? 'Aún no hay ninguna' : stats.bestIsCurrent ? <span className="jd-same">Es la actual</span> : dateRange(stats.bestFrom!, stats.bestTo!)}
                </dd>
            </div>
            <div className="hg-tile jd-ok hg-enter" style={{ '--i': 3 } as CSSProperties}>
                <dt>
                    <span className="hg-tile__icon hg-tint">
                        <Check aria-hidden />
                    </span>
                    Acertados
                </dt>
                <dd className="hg-tile__value">
                    <CountUp value={stats.wins} />
                </dd>
                <dd className="hg-tile__note">
                    de <b>{finished.toLocaleString('es-ES')}</b> jugados{stats.progress ? ` · ${stats.progress} en curso` : ''}
                </dd>
            </div>
            <div className="hg-tile jd-ok hg-enter" style={{ '--i': 4 } as CSSProperties}>
                <dt>
                    <span className="hg-tile__icon hg-tint">
                        <Percent aria-hidden />
                    </span>
                    De acierto
                </dt>
                <dd className="hg-tile__value">
                    <CountUp value={stats.accuracy} suffix="%" />
                </dd>
                <dd className="jd-acc hg-bar--fill" role="img" aria-label={`${plural(stats.wins, 'acertado', 'acertados')} y ${plural(stats.losses, 'fallado', 'fallados')}`}>
                    {finished > 0 && (
                        <>
                            <span className="jd-acc__w" style={{ width: `${(stats.wins / finished) * 100}%` }} />
                            <span className="jd-acc__l" style={{ width: `${(stats.losses / finished) * 100}%`, '--i': 1 } as CSSProperties} />
                        </>
                    )}
                </dd>
                <dd className="hg-tile__note">{plural(stats.losses, 'fallado', 'fallados')}</dd>
            </div>
            <div className="hg-tile st-todos hg-enter" style={{ '--i': 5 } as CSSProperties}>
                <dt>
                    <span className="hg-tile__icon hg-tint">
                        <Layers aria-hidden />
                    </span>
                    Media de intentos
                </dt>
                <dd className="hg-tile__value">{stats.avgAttempt === null ? '—' : <CountUp value={Math.round(stats.avgAttempt * 10) / 10} decimals={1} />}</dd>
                <dd className="hg-tile__note">{stats.avgAttempt === null ? 'Cuando aciertes alguno' : 'Intento medio en el que aciertas'}</dd>
            </div>
            <div className="hg-tile st-todos hg-enter" style={{ '--i': 6 } as CSSProperties}>
                <dt>
                    <span className="hg-tile__icon hg-tint">
                        <Trophy aria-hidden />
                    </span>
                    Puntos
                </dt>
                <dd className="hg-tile__value">
                    <CountUp value={stats.points} />
                </dd>
                <dd className="hg-tile__note">
                    {guest ? (
                        <>
                            <Link href="/login" className="jd-tile-link">
                                Inicia sesión
                            </Link>{' '}
                            para entrar en el ranking
                        </>
                    ) : rank ? (
                        <Link href="/ranking" className="jd-tile-link">
                            <b>
                                {rank.position}.º de {rank.total}
                            </b>{' '}
                            en el ranking
                        </Link>
                    ) : (
                        <Link href="/ranking" className="jd-tile-link">
                            Ver el ranking
                        </Link>
                    )}
                </dd>
            </div>
        </dl>
    )
}

function Distribution({ stats }: { stats: JudiStats }) {
    const max = Math.max(1, ...stats.dist, stats.losses)
    const top = stats.wins ? stats.dist.indexOf(Math.max(...stats.dist)) : -1
    return (
        <section className="jd-dist glass hg-enter" style={{ '--i': 7 } as CSSProperties} aria-labelledby="jd-dist-title">
            <div className="dash-sec__head">
                <span className="dash-sec__icon hg-tint jd-ok">
                    <ChartBar aria-hidden />
                </span>
                <h2 id="jd-dist-title" className="dash-sec__title">
                    En qué intento aciertas
                </h2>
            </div>
            <ul className="jd-dist__rows">
                {stats.dist.map((n, i) => (
                    <li key={i} className={`jd-dist__row${i === top ? ' is-top' : ''}`}>
                        <span className="jd-dist__label">
                            {i + 1}.º <small>+{6 - i}</small>
                        </span>
                        <span className="jd-dist__track" aria-hidden>
                            <span className="jd-dist__fill" style={{ width: `${(n / max) * 100}%`, '--i': i } as CSSProperties} />
                        </span>
                        <span className="jd-dist__n">
                            <span className="sr-only">
                                {plural(n, 'acierto', 'aciertos')} en el intento {i + 1}:{' '}
                            </span>
                            <span aria-hidden>{n}</span>
                        </span>
                    </li>
                ))}
                <li className="jd-dist__row is-lost">
                    <span className="jd-dist__label">
                        <X aria-hidden strokeWidth={3} /> Sin acertar
                    </span>
                    <span className="jd-dist__track" aria-hidden>
                        <span className="jd-dist__fill" style={{ width: `${(stats.losses / max) * 100}%`, '--i': 6 } as CSSProperties} />
                    </span>
                    <span className="jd-dist__n">{stats.losses}</span>
                </li>
            </ul>
            {top >= 0 && (
                <p className="jd-dist__foot">
                    Sueles acertar en el <b>intento {top + 1}</b>
                    {top === 0 ? ', con la primera captura' : ''}.
                </p>
            )}
        </section>
    )
}

/* ── Mapa del año ── */

function YearMap({
    days,
    year,
    today,
    filter,
    spotDates,
    onPick,
}: {
    days: JudiHistoryDay[]
    year: number
    today: string
    filter: JudiFilter
    spotDates: string[] | null
    onPick: (day: JudiHistoryDay) => void
}) {
    const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days])
    const map = useMemo(() => yearHeatmap(year, new Map(), parseDayKey(today)), [year, today])
    const inYear = days.filter((d) => d.date.startsWith(`${year}-`))
    const played = inYear.filter((d) => d.status === 'won' || d.status === 'lost').length
    const spot = spotDates && spotDates.length ? new Set(spotDates) : null

    const describe = (h: HeatDay) => {
        const d = byDate.get(h.date)
        return d ? `${judiDayShort(h.date)} · #${d.id} · ${dayWord(d)}` : `${judiDayShort(h.date)} · sin JUDI`
    }
    const decorate = (h: HeatDay) => {
        if (h.out || h.future) return undefined
        const d = byDate.get(h.date)
        if (!d) return { className: 'is-none' }
        return {
            className: [`s-${d.status}`, filter !== 'all' && !matchesJudiFilter(d, filter) && 'is-dim', spot?.has(h.date) && 'is-spot'].filter(Boolean).join(' '),
        }
    }
    const wins = inYear.filter((d) => d.status === 'won').length
    const losses = inYear.filter((d) => d.status === 'lost').length

    return (
        <ActivityHeatmap
            map={map}
            className="jd-heat"
            gridLabel={`Tus días de JUDI en ${year}. Usa las flechas para moverte e Intro para ir a un día.`}
            gridClass={spot ? 'is-spot' : undefined}
            decorate={decorate}
            describe={describe}
            onPick={(h) => {
                const d = byDate.get(h.date)
                if (d) onPick(d)
            }}
            focusDay={today}
            weekdays
            range={false}
            summary={`En ${year}: ${plural(wins, 'acertado', 'acertados')}, ${plural(losses, 'fallado', 'fallados')} y ${plural(inYear.length - wins - losses, 'día sin terminar', 'días sin terminar')}.`}
            legend={
                <span className="jd-heat__legend" aria-hidden>
                    <span>
                        <i className="s-won" />
                        Acertado
                    </span>
                    <span>
                        <i className="s-lost" />
                        Fallado
                    </span>
                    <span>
                        <i className="s-progress" />
                        En curso
                    </span>
                    <span>
                        <i />
                        Sin jugar
                    </span>
                    <span>
                        <i className="is-none" />
                        Sin JUDI
                    </span>
                </span>
            }
            footer={
                <span className="heat__extra">
                    {played.toLocaleString('es-ES')} de {plural(inYear.length, 'día jugado', 'días jugados')} en {year}
                </span>
            }
        />
    )
}

/* ── Todo junto ── */

/**
 * Portada de /judi bajo la tarjeta del día: tus cifras (tiles con racha, aciertos, % de acierto, media de intentos y
 * puntos con tu puesto), «En qué intento aciertas» y el historial (mapa del año con el resultado de cada día, filtros
 * con contador y meses plegables con una fila por día). Mockup: docs/mockups/judi-historial.html
 */
export default function JudiHome({
    days,
    today,
    rank,
    guest,
    filter,
    onFilter,
    openMonths,
    onToggleMonth,
    onPlay,
    nudge,
}: {
    days: JudiHistoryDay[]
    /** Hoy en Madrid (AAAA-MM-DD). */
    today: string
    rank: JudiRank
    guest: boolean
    filter: JudiFilter
    onFilter: (f: JudiFilter) => void
    openMonths: string[]
    onToggleMonth: (key: string, open: boolean) => void
    onPlay: (id: number) => void
    /** Aviso para invitados (entre las cifras y el historial). */
    nudge?: ReactNode
}) {
    const reduce = useReducedMotion()
    const stats = useMemo(() => judiStats(days, today), [days, today])
    const counts = useMemo(() => judiFilterCounts(days), [days])
    const months = useMemo(() => judiMonths(days, filter), [days, filter])
    const years = useMemo(() => [...new Set(days.map((d) => Number(d.date.slice(0, 4))))].sort((a, b) => b - a), [days])
    const [year, setYear] = useState(() => years[0] ?? Number(today.slice(0, 4)))
    const [spot, setSpot] = useState<'streak' | 'best' | null>(null)
    const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
    const [flash, setFlash] = useState<{ id: number; n: number } | null>(null)
    const todayDay = days.find((d) => d.date === today) ?? null
    const nothing = stats.played + stats.progress === 0
    const currentYear = today.slice(0, 4)

    // Si el filtro deja fuera todos los meses abiertos, se abre el primero que queda.
    const shownOpen = months.some((m) => openMonths.includes(m.key))
    const firstKey = months[0]?.key
    useEffect(() => {
        if (!shownOpen && firstKey) onToggleMonth(firstKey, true)
    }, [shownOpen, firstKey, onToggleMonth])

    // Al llegar desde el mapa: baja hasta el día (cuando su mes ya está abierto) y lo marca un momento.
    useEffect(() => {
        if (!flash) return
        let frames = 0
        let raf = 0
        const find = () => {
            const el = document.getElementById(`jd-day-${flash.id}`)
            if (!el && frames++ < 40) {
                raf = requestAnimationFrame(find)
                return
            }
            el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
        }
        raf = requestAnimationFrame(find)
        const off = window.setTimeout(() => setFlash(null), 1300)
        return () => {
            cancelAnimationFrame(raf)
            window.clearTimeout(off)
        }
    }, [flash, reduce])

    const pickDay = (d: JudiHistoryDay) => {
        if (!matchesJudiFilter(d, filter)) onFilter('all')
        onToggleMonth(d.date.slice(0, 7), true)
        setFlash((f) => ({ id: d.id, n: (f?.n ?? 0) + 1 }))
    }

    const toggleDay = (id: number) =>
        setExpanded((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })

    const spotDates = spot === 'streak' ? stats.streakDates : spot === 'best' ? stats.bestDates : null
    const f = JUDI_FILTER_LABELS[filter]

    return (
        <>
            {nothing ? (
                <EmptyState
                    tone="st-todos"
                    icon={<Flame />}
                    title="Aún no has jugado ningún JUDI"
                    className="hg-enter"
                    style={{ '--i': 1 } as CSSProperties}
                    action={
                        todayDay && (
                            <Button size="sm" onClick={() => onPlay(todayDay.id)}>
                                Jugar el de hoy
                                <ArrowRight data-icon="inline-end" aria-hidden />
                            </Button>
                        )
                    }
                >
                    Acierta el de hoy y empieza tu racha. También puedes jugar cualquier día pasado.
                </EmptyState>
            ) : (
                <div className="jd-stats">
                    <StatsTiles stats={stats} todayStatus={todayDay?.status ?? null} rank={rank} guest={guest} onSpot={setSpot} />
                    <Distribution stats={stats} />
                </div>
            )}

            {nudge}

            <section className="jd-history hg-enter" style={{ '--i': 8 } as CSSProperties} aria-labelledby="jd-history-title">
                <div className="jd-history__head">
                    <div className="dash-sec__head">
                        <span className="dash-sec__icon hg-tint st-todos">
                            <History aria-hidden />
                        </span>
                        <h2 id="jd-history-title" className="dash-sec__title">
                            Historial
                        </h2>
                        <span className="dash-sec__count">
                            {plural(days.length, 'día', 'días')} · {plural(stats.played, 'jugado', 'jugados')}
                        </span>
                    </div>
                    <p className="jd-history__hint">Puedes jugar cualquier día pasado.</p>
                </div>

                {days.length > 0 && (
                    <div className="jd-heat-wrap glass">
                        {years.length > 1 && (
                            <Segmented
                                value={String(year)}
                                options={years.map(String)}
                                labels={Object.fromEntries(years.map((y) => [String(y), String(y)]))}
                                onChange={(y) => setYear(Number(y))}
                                aria-label="Año del mapa"
                                className="jd-heat__years"
                            />
                        )}
                        <YearMap key={year} days={days} year={year} today={today} filter={filter} spotDates={spotDates} onPick={pickDay} />
                    </div>
                )}

                <Segmented
                    value={filter}
                    options={JUDI_FILTERS}
                    labels={JUDI_FILTER_LABELS}
                    onChange={onFilter}
                    counts={counts}
                    icons={FILTER_ICONS}
                    countClassName={countClass}
                    scroll
                    aria-label="Filtrar días"
                    className="jd-filters"
                />

                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={filter}
                        className="jd-months"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { duration: reduce ? 0 : 0.22 } }}
                        exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.12 } }}
                    >
                        {months.length === 0 ? (
                            <EmptyState
                                size="page"
                                tone={filter === 'won' ? 'jd-ok' : filter === 'lost' ? 'jd-ko' : filter === 'progress' ? 'st-todos' : 'neutral'}
                                icon={FILTER_ICONS[filter] ?? <Flame />}
                                title={
                                    filter === 'won'
                                        ? 'Ningún día acertado todavía'
                                        : filter === 'lost'
                                          ? 'Ningún día fallado'
                                          : filter === 'progress'
                                            ? 'Ningún día a medias'
                                            : filter === 'new'
                                              ? 'Has jugado todos los días'
                                              : 'Aún no hay ningún JUDI'
                                }
                                action={
                                    filter !== 'all' && (
                                        <Button variant="secondary" size="sm" onClick={() => onFilter('all')}>
                                            Ver todos los días
                                        </Button>
                                    )
                                }
                            >
                                Nada en «{f}».
                            </EmptyState>
                        ) : (
                            months.map((m) => {
                                const open = openMonths.includes(m.key)
                                const total = m.all.length
                                const rest = total - m.won - m.lost - m.progress
                                return (
                                    <div key={m.key} className={`jd-month${open ? ' is-open' : ''}`}>
                                        <button type="button" className="jd-month__head" onClick={() => onToggleMonth(m.key, !open)} aria-expanded={open}>
                                            <ChevronDown className="jd-chev" aria-hidden />
                                            <span className="jd-month__label">
                                                {monthLabel(m.key, currentYear)}
                                                {m.key === today.slice(0, 7) && <small>este mes</small>}
                                            </span>
                                            <span
                                                className="jd-month__bar"
                                                role="img"
                                                aria-label={`${plural(m.won, 'acertado', 'acertados')}, ${plural(m.lost, 'fallado', 'fallados')}, ${m.progress} en curso y ${rest} sin jugar`}
                                            >
                                                <span className="jd-month__bar-won" style={{ width: `${(m.won / total) * 100}%` }} />
                                                <span className="jd-month__bar-lost" style={{ width: `${(m.lost / total) * 100}%` }} />
                                                <span className="jd-month__bar-progress" style={{ width: `${(m.progress / total) * 100}%` }} />
                                            </span>
                                            <span className="jd-month__count">
                                                {filter === 'all' ? (
                                                    <>
                                                        <b>{m.won}</b> de {total} acertados
                                                    </>
                                                ) : (
                                                    <>
                                                        <b>{m.shown.length}</b> {m.shown.length === 1 ? ONE[filter] : JUDI_FILTER_LABELS[filter].toLowerCase()}
                                                    </>
                                                )}
                                            </span>
                                        </button>
                                        <AnimatePresence initial={false}>
                                            {open && (
                                                <motion.div
                                                    key="days"
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={reduce ? { duration: 0 } : { height: { duration: 0.3, ease: EASE_OUT }, opacity: { duration: 0.18 } }}
                                                    style={{ overflow: 'hidden' }}
                                                >
                                                    <ul className="jd-days">
                                                        {m.shown.map((d, i) => (
                                                            <JudiDayRow
                                                                key={d.id}
                                                                day={d}
                                                                index={i}
                                                                isToday={d.date === today}
                                                                open={expanded.has(d.id)}
                                                                onToggle={() => toggleDay(d.id)}
                                                                onPlay={() => onPlay(d.id)}
                                                                flash={flash?.id === d.id}
                                                            />
                                                        ))}
                                                    </ul>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )
                            })
                        )}
                    </motion.div>
                </AnimatePresence>
            </section>
        </>
    )
}

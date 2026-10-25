'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, X } from 'lucide-react'
import { safeGetSession } from '@/lib/supabase/client'
import { loadLibrary } from '@/lib/tracker'
import type { Achievement } from '@/lib/achievements'
import { loadUnlockedAchievements } from '@/lib/achievements-db'
import {
    countByDay,
    groupTimeline,
    heatLevel,
    heatmapWeeks,
    parseDayKey,
    streaks,
    yearsWithUnlocks,
    type Streak,
    type TimelineDay,
} from '@/lib/achievement-history'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Loader from '@/components/Loader'
import AchievementItem from '@/components/achievements/AchievementItem'
import '@/components/achievements/achievements.css'

const DAYS_STEP = 15
const WEEKDAYS = ['L', '', 'X', '', 'V', '', 'D']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const LONG_DAY = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const SHORT_DAY = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const WEEKDAY = new Intl.DateTimeFormat('es-ES', { weekday: 'short' })
const MONTH_YEAR = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })

interface Data {
    unlocked: Achievement[]
    names: Map<number, string>
}

function streakRange(s: Streak): string {
    if (!s.start || !s.end) return 'Sin racha'
    if (s.start === s.end) return SHORT_DAY.format(parseDayKey(s.start))
    return `${SHORT_DAY.format(parseDayKey(s.start))} – ${SHORT_DAY.format(parseDayKey(s.end))}`
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1)
}

function plural(n: number, one: string, many: string): string {
    return `${n.toLocaleString('es-ES')} ${n === 1 ? one : many}`
}

function dayTotal(d: TimelineDay<Achievement>): number {
    return d.games.reduce((n, g) => n + g.achievements.length, 0)
}

/** Días seguidos del mismo mes, juntos bajo su encabezado ("Octubre de 2026"). */
function byMonth(days: TimelineDay<Achievement>[]): { month: string; days: TimelineDay<Achievement>[] }[] {
    const out: { month: string; days: TimelineDay<Achievement>[] }[] = []
    for (const d of days) {
        const month = d.day.slice(0, 7)
        const last = out[out.length - 1]
        if (last && last.month === month) last.days.push(d)
        else out.push({ month, days: [d] })
    }
    return out
}

/** Línea temporal y heatmap de desbloqueos (#28), con la racha de días seguidos con algún logro. */
export default function HistorialPage() {
    const router = useRouter()
    const [data, setData] = useState<Data | null>(null)
    const [error, setError] = useState('')
    const [year, setYear] = useState(() => new Date().getFullYear())
    const [selectedDay, setSelectedDay] = useState<string | null>(null)
    const [visibleDays, setVisibleDays] = useState(DAYS_STEP)

    useEffect(() => {
        safeGetSession().then(({ data: { session } }) => {
            if (!session) {
                router.push('/login')
                return
            }
            Promise.all([loadUnlockedAchievements(), loadLibrary()])
                .then(([unlocked, games]) => setData({ unlocked, names: new Map(games.map((g) => [g.appid, g.name ?? `App ${g.appid}`])) }))
                .catch((e: Error) => {
                    setError(e.message)
                    setData({ unlocked: [], names: new Map() })
                })
        })
    }, [router])

    const derived = useMemo(() => {
        if (!data) return null
        const counts = countByDay(data.unlocked)
        return { counts, timeline: groupTimeline(data.unlocked), streak: streaks(counts.keys()), years: yearsWithUnlocks(counts) }
    }, [data])

    const weeks = useMemo(() => (derived ? heatmapWeeks(year, derived.counts) : []), [derived, year])
    const heatmapScroll = useRef<HTMLDivElement>(null)

    // En pantallas estrechas el heatmap se desplaza: el año en curso abre en los meses más recientes.
    useEffect(() => {
        const el = heatmapScroll.current
        if (el) el.scrollLeft = year === new Date().getFullYear() ? el.scrollWidth : 0
    }, [year, weeks])

    if (!data || !derived) return <Loader label="Cargando historial" resetScroll />

    const thisYear = new Date().getFullYear()
    const years = derived.years.includes(thisYear) ? derived.years : [thisYear, ...derived.years]
    const yearTotal = weeks.flat().reduce((n, c) => n + (c.inYear ? c.count : 0), 0)
    const timeline = selectedDay ? derived.timeline.filter((d) => d.day === selectedDay) : derived.timeline
    const months = byMonth(timeline.slice(0, visibleDays))
    const gameName = (appid: number) => data.names.get(appid) ?? `App ${appid}`

    // Etiqueta del mes encima de la primera semana que empieza en él.
    const monthLabels = weeks.map((w, i) => {
        const firstInYear = w.find((c) => c.inYear)
        if (!firstInYear) return ''
        const month = Number(firstInYear.day.slice(5, 7)) - 1
        const prev = weeks[i - 1]?.find((c) => c.inYear)
        return !prev || Number(prev.day.slice(5, 7)) - 1 !== month ? MONTHS[month] : ''
    })

    function pickDay(day: string, count: number) {
        if (count === 0) return
        setSelectedDay((d) => (d === day ? null : day))
        setVisibleDays(DAYS_STEP)
        document.getElementById('historial-timeline')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    return (
        <div className="logros">
            <header className="page-head">
                <div>
                    <Link href="/logros" className="logros__back">
                        <ArrowLeft size={14} aria-hidden /> Logros
                    </Link>
                    <h1 className="page-title">Historial</h1>
                    <p className="page-subtitle">
                        {plural(data.unlocked.length, 'logro', 'logros')} en {plural(derived.counts.size, 'día', 'días')} distintos.
                    </p>
                </div>
            </header>

            {error && (
                <p className="alert alert--error" role="alert">
                    {error}
                </p>
            )}

            <section className="heatmap glass" aria-labelledby="historial-heatmap">
                <header className="heatmap__head">
                    <div className="heatmap__stats">
                        <h2 id="historial-heatmap" className="heatmap__stat">
                            <b>{yearTotal.toLocaleString('es-ES')}</b> {yearTotal === 1 ? 'logro' : 'logros'} en {year}
                        </h2>
                        <p className={`heatmap__stat${derived.streak.current.length > 0 ? ' is-active' : ''}`} title={streakRange(derived.streak.current)}>
                            <b>{derived.streak.current.length.toLocaleString('es-ES')}</b> {derived.streak.current.length === 1 ? 'día' : 'días'} de racha
                        </p>
                        <p className="heatmap__stat" title={streakRange(derived.streak.best)}>
                            <b>{derived.streak.best.length.toLocaleString('es-ES')}</b> {derived.streak.best.length === 1 ? 'día' : 'días'} en tu mejor racha
                            {derived.streak.best.length > 0 && <span className="heatmap__range">{streakRange(derived.streak.best)}</span>}
                        </p>
                    </div>
                    <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                        <SelectTrigger className="heatmap__year" aria-label="Año">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map((y) => (
                                <SelectItem key={y} value={String(y)}>
                                    {y}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </header>
                <div className="heatmap__scroll" ref={heatmapScroll}>
                    <div className="heatmap__grid" style={{ gridTemplateColumns: `24px repeat(${weeks.length}, minmax(0, 1fr))` }}>
                        <span />
                        {monthLabels.map((m, i) => (
                            <span key={i} className="heatmap__month">
                                {m}
                            </span>
                        ))}
                        {WEEKDAYS.map((label, row) => (
                            <div key={row} className="heatmap__row">
                                <span className="heatmap__weekday">{label}</span>
                                {weeks.map((w) => {
                                    const cell = w[row]
                                    if (!cell.inYear) return <span key={cell.day} className="heatmap__cell is-out" aria-hidden />
                                    const text = `${plural(cell.count, 'logro', 'logros')} el ${LONG_DAY.format(parseDayKey(cell.day))}`
                                    return (
                                        <button
                                            key={cell.day}
                                            type="button"
                                            className={`heatmap__cell ${selectedDay === cell.day ? 'is-selected' : ''}`}
                                            data-l={heatLevel(cell.count)}
                                            title={text}
                                            aria-label={text}
                                            aria-pressed={selectedDay === cell.day}
                                            disabled={cell.count === 0}
                                            onClick={() => pickDay(cell.day, cell.count)}
                                        />
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                </div>
                <p className="heatmap__legend">
                    <span aria-hidden className="heatmap__scale">
                        menos
                        {[0, 1, 2, 3, 4].map((l) => (
                            <span key={l} className="heatmap__cell" data-l={l} />
                        ))}
                        más
                    </span>
                    <span>Pulsa un día para ver solo sus logros.</span>
                </p>
            </section>

            <section id="historial-timeline" className="timeline" aria-label="Desbloqueos por día">
                {selectedDay && (
                    <p className="timeline__filter">
                        Solo el {LONG_DAY.format(parseDayKey(selectedDay))}.
                        <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>
                            <X aria-hidden /> Ver todos los días
                        </Button>
                    </p>
                )}
                {timeline.length === 0 && <p className="hg-empty">Aún no hay desbloqueos.</p>}
                {months.map((m) => {
                    const monthTotal = m.days.reduce((n, d) => n + dayTotal(d), 0)
                    return (
                        <section key={m.month} className="tl-month" aria-label={capitalize(MONTH_YEAR.format(parseDayKey(`${m.month}-01`)))}>
                            <h2 className="tl-month__title">
                                {capitalize(MONTH_YEAR.format(parseDayKey(`${m.month}-01`)))}
                                <span className="hg-section__count">{plural(monthTotal, 'logro', 'logros')}</span>
                            </h2>
                            <ol className="tl-days">
                                {m.days.map((d) => {
                                    const date = parseDayKey(d.day)
                                    return (
                                        <li key={d.day} className="tl-day">
                                            <p className="tl-day__date" aria-hidden>
                                                <b>{date.getDate()}</b>
                                                <span>{WEEKDAY.format(date).replace('.', '')}</span>
                                            </p>
                                            <div className="tl-day__body">
                                                <h3 className="tl-day__title">
                                                    <span className="sr-only">{capitalize(LONG_DAY.format(date))}: </span>
                                                    {plural(dayTotal(d), 'logro', 'logros')}
                                                </h3>
                                                {d.games.map((g) => (
                                                    <div key={g.appid} className="tl-game">
                                                        <Link href={`/juego/${g.appid}/logros`} className="tl-game__name">
                                                            {gameName(g.appid)}
                                                        </Link>
                                                        <ul className="hg-achs ach-list">
                                                            {g.achievements.map((a) => (
                                                                <AchievementItem key={a.apiname} achievement={a} gameName={gameName(g.appid)} hideDate />
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        </li>
                                    )
                                })}
                            </ol>
                        </section>
                    )
                })}
                {timeline.length > visibleDays && (
                    <Button variant="secondary" className="hg-more" onClick={() => setVisibleDays((n) => n + DAYS_STEP)}>
                        Ver días anteriores
                    </Button>
                )}
            </section>
        </div>
    )
}

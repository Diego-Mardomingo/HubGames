'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarDays, Flame, History, Trophy, X } from 'lucide-react'
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
} from '@/lib/achievement-history'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Loader from '@/components/Loader'
import { Reveal } from '@/components/motion'
import AchievementItem from '@/components/achievements/AchievementItem'
import '@/components/achievements/achievements.css'

const DAYS_STEP = 15
const WEEKDAYS = ['L', '', 'X', '', 'V', '', 'D']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const LONG_DAY = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const SHORT_DAY = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

interface Data {
    unlocked: Achievement[]
    names: Map<number, string>
}

function streakRange(s: Streak): string {
    if (!s.start || !s.end) return 'Sin racha'
    if (s.start === s.end) return SHORT_DAY.format(parseDayKey(s.start))
    return `${SHORT_DAY.format(parseDayKey(s.start))} – ${SHORT_DAY.format(parseDayKey(s.end))}`
}

function plural(n: number, one: string, many: string): string {
    return `${n.toLocaleString('es-ES')} ${n === 1 ? one : many}`
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

    if (!data || !derived) return <Loader label="Cargando historial" />

    const thisYear = new Date().getFullYear()
    const years = derived.years.includes(thisYear) ? derived.years : [thisYear, ...derived.years]
    const yearTotal = weeks.flat().reduce((n, c) => n + (c.inYear ? c.count : 0), 0)
    const timeline = selectedDay ? derived.timeline.filter((d) => d.day === selectedDay) : derived.timeline
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
        <div className="logros logros--wide">
            <Link href="/logros" className="eyebrow logros__back">
                <ArrowLeft size={13} aria-hidden /> Logros
            </Link>

            <header className="page-head">
                <div>
                    <Reveal>
                        <span className="eyebrow">
                            <History size={13} aria-hidden /> Historial
                        </span>
                    </Reveal>
                    <Reveal delay={0.05}>
                        <h1 className="page-title">Línea temporal</h1>
                    </Reveal>
                    <Reveal delay={0.1}>
                        <p className="page-subtitle">
                            {plural(data.unlocked.length, 'logro', 'logros')} en {plural(derived.counts.size, 'día', 'días')} distintos.
                        </p>
                    </Reveal>
                </div>
            </header>

            {error && (
                <p className="alert alert--error" role="alert">
                    {error}
                </p>
            )}

            <div className="streaks">
                <div className={`streak glass ${derived.streak.current.length > 0 ? 'is-active' : ''}`}>
                    <Flame size={18} aria-hidden />
                    <div>
                        <p className="streak__value">{plural(derived.streak.current.length, 'día', 'días')}</p>
                        <p className="streak__label">Racha actual · {streakRange(derived.streak.current)}</p>
                    </div>
                </div>
                <div className="streak glass">
                    <Trophy size={18} aria-hidden />
                    <div>
                        <p className="streak__value">{plural(derived.streak.best.length, 'día', 'días')}</p>
                        <p className="streak__label">Mejor racha · {streakRange(derived.streak.best)}</p>
                    </div>
                </div>
            </div>

            <section className="heatmap glass" aria-labelledby="historial-heatmap">
                <header className="heatmap__head">
                    <h2 id="historial-heatmap" className="hunt__title">
                        <CalendarDays size={16} aria-hidden /> {plural(yearTotal, 'logro', 'logros')} en {year}
                    </h2>
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
                <div className="heatmap__scroll">
                    <div className="heatmap__grid" style={{ gridTemplateColumns: `24px repeat(${weeks.length}, 1fr)` }}>
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
                                            className={`heatmap__cell heat-${heatLevel(cell.count)} ${selectedDay === cell.day ? 'is-selected' : ''}`}
                                            title={text}
                                            aria-label={text}
                                            disabled={cell.count === 0}
                                            onClick={() => pickDay(cell.day, cell.count)}
                                        />
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                </div>
                <p className="heatmap__legend" aria-hidden>
                    Menos
                    {[0, 1, 2, 3, 4].map((l) => (
                        <span key={l} className={`heatmap__cell heat-${l}`} />
                    ))}
                    Más
                </p>
            </section>

            <section id="historial-timeline" className="timeline" aria-label="Desbloqueos por día">
                {selectedDay && (
                    <p className="timeline__filter">
                        Solo el {LONG_DAY.format(parseDayKey(selectedDay))}.
                        <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>
                            <X aria-hidden /> Ver todos
                        </Button>
                    </p>
                )}
                {timeline.length === 0 && <p className="logros__empty glass">Aún no hay desbloqueos.</p>}
                {timeline.slice(0, visibleDays).map((d) => {
                    const total = d.games.reduce((n, g) => n + g.achievements.length, 0)
                    return (
                        <article key={d.day} className="timeline__day">
                            <h2 className="timeline__date">
                                {LONG_DAY.format(parseDayKey(d.day))}
                                <span className="ach-tab__count">{total}</span>
                            </h2>
                            {d.games.map((g) => (
                                <div key={g.appid} className="timeline__game glass">
                                    <Link href={`/juego/${g.appid}/logros`} className="timeline__game-name">
                                        {gameName(g.appid)}
                                    </Link>
                                    <ul className="ach-list">
                                        {g.achievements.map((a) => (
                                            <AchievementItem key={a.apiname} achievement={a} gameName={gameName(g.appid)} />
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </article>
                    )
                })}
                {timeline.length > visibleDays && (
                    <Button variant="secondary" className="hunt__more" onClick={() => setVisibleDays((n) => n + DAYS_STEP)}>
                        Ver días anteriores
                    </Button>
                )}
            </section>
        </div>
    )
}

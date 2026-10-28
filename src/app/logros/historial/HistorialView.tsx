'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, Award, CalendarDays, Check, ChevronDown, ChevronRight, Flame, Medal, TriangleAlert, Trophy, X } from 'lucide-react'
import type { LibraryGame } from '@/lib/tracker'
import { computeMilestones, formatPercent, type Achievement, type Milestone } from '@/lib/achievements'
import {
    byMonth,
    countByDay,
    daySummary,
    dayKey,
    groupTimeline,
    milestonesByDay,
    monthSummary,
    notableRarities,
    parseDayKey,
    perfectDays,
    streakAtRisk,
    streakIndex,
    streaks,
    yearHeatmap,
    yearSummary,
    yearsWithUnlocks,
    type Streak,
    type TimelineDay,
} from '@/lib/achievement-history'
import type { HeatDay } from '@/lib/activity-heatmap'
import { RARITY_TIERS, RARITY_TIER_LABELS, rarityColor, rarityTier, type RarityTier } from '@/lib/rarity'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import CountUp from '@/components/CountUp'
import Tile from '@/components/Tile'
import ActivityHeatmap from '@/components/dashboard/ActivityHeatmap'
import SyncButton from '@/components/dashboard/SyncButton'
import AchievementItem from '@/components/achievements/AchievementItem'
import { seriesOf } from '@/components/achievements/Milestones'
import GameCover from '@/components/tracker/GameCover'
import { MarkFlags, StatusChip } from '@/components/tracker/status'
import '@/components/achievements/achievements.css'
import '@/components/dashboard/dashboard.css'
import './historial.css'

/** Meses que se enseñan de cada vez («Ver meses anteriores»). */
const MONTHS_STEP = 6
/** Logros de un mismo juego en un día antes de «Ver N más». */
const GAME_LIMIT = 5

type CSSVars = CSSProperties & Record<`--${string}`, string | number>

export interface HistorialData {
    unlocked: Achievement[]
    games: LibraryGame[]
}

const LONG_DAY = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const SHORT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })
const SHORT_Y = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const WEEKDAY = new Intl.DateTimeFormat('es-ES', { weekday: 'short' })
const MONTH_YEAR = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })

const n = (v: number) => v.toLocaleString('es-ES')
const plural = (v: number, one: string, many: string) => `${n(v)} ${v === 1 ? one : many}`
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const long = (day: string) => LONG_DAY.format(parseDayKey(day))
const short = (day: string) => SHORT.format(parseDayKey(day)).replace('.', '')
const shortY = (day: string) => SHORT_Y.format(parseDayKey(day)).replace('.', '')
const monthName = (month: string) => cap(MONTH_YEAR.format(parseDayKey(`${month}-01`)))
/** Posición en la entrada escalonada (`.hg-enter`, styles/lists.css). */
const enter = (i: number): CSSVars => ({ '--i': i })

function reducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** «23 oct – 2 nov 2026», o con los dos años si cambia. */
function rangeText(s: Streak): string {
    if (!s.start || !s.end) return ''
    if (s.start === s.end) return shortY(s.start)
    return `${s.start.slice(0, 4) === s.end.slice(0, 4) ? short(s.start) : shortY(s.start)} – ${shortY(s.end)}`
}

/** «5 logros · 1 épica · 2 raras» de un día, en texto (tooltip del mapa, lectores de pantalla). */
function dayText(day: HeatDay, rare: (d: string) => string): string {
    if (day.achievements === 0) return `${cap(long(day.date))}: sin logros`
    const extra = rare(day.date)
    return `${cap(long(day.date))}: ${plural(day.achievements, 'logro', 'logros')}${extra ? ` · ${extra}` : ''}`
}

/** Reparto por rareza: barra apilada y leyenda (comunes y poco comunes se esconden en móvil). */
function RaritySummary({ tiers, total }: { tiers: Record<RarityTier, number>; total: number }) {
    const present = RARITY_TIERS.filter((t) => tiers[t] > 0)
    return (
        <div className="hi-rar">
            <span className="hi-rar__bar" role="img" aria-label={`Reparto por rareza de ${plural(total, 'logro', 'logros')}`}>
                {present.map((t) => (
                    <span key={t} style={{ flex: tiers[t], '--c': rarityColor(t) } as CSSVars} title={`${RARITY_TIER_LABELS[t]}: ${n(tiers[t])}`} />
                ))}
            </span>
            <ul className="hi-rar__legend">
                {present.map((t) => (
                    <li key={t} className={t === 'comun' || t === 'poco' ? 'is-low' : undefined} style={{ '--c': rarityColor(t) } as CSSVars}>
                        {RARITY_TIER_LABELS[t]} <b>{n(tiers[t])}</b>
                    </li>
                ))}
            </ul>
        </div>
    )
}

interface DayCtx {
    game: (appid: number) => LibraryGame | undefined
    gameName: (appid: number) => string
    perfect: Map<number, string>
    milestones: Map<string, Milestone[]>
    today: string
    yesterday: string
}

/** Un juego dentro de un día: cápsula, lista, marcas, cuántos ese día, sello del 100 % y sus logros con la hora. */
function DayGame({ day, entry, ctx }: { day: string; entry: TimelineDay<Achievement>['games'][number]; ctx: DayCtx }) {
    const [all, setAll] = useState(false)
    const g = ctx.game(entry.appid)
    const name = ctx.gameName(entry.appid)
    const list = all ? entry.achievements : entry.achievements.slice(0, GAME_LIMIT)
    const more = entry.achievements.length - GAME_LIMIT
    const perfect = ctx.perfect.get(entry.appid) === day
    return (
        <div className="hi-game">
            <div className="hi-game__head">
                <span className="hi-game__cover">
                    <GameCover appid={entry.appid} name={name} headerImage={g?.header_image ?? null} variant="header" sizes="64px" />
                </span>
                <Link href={`/juego/${entry.appid}/logros`} className="hi-game__name" title={name}>
                    {name}
                </Link>
                {g && <StatusChip status={g.status} />}
                {g && <MarkFlags favorite={g.favorite} endless={g.endless} />}
                <span className="hi-game__count">{plural(entry.achievements.length, 'logro', 'logros')}</span>
                {perfect && (
                    <span className="hi-stamp hg-pop-in" title="Ese día conseguiste todos sus logros">
                        <Check aria-hidden />
                        100 %
                    </span>
                )}
            </div>
            <ul className="hg-achs ach-list">
                {list.map((a, j) => (
                    <AchievementItem key={a.apiname} achievement={a} gameName={name} showTime index={j >= GAME_LIMIT ? j - GAME_LIMIT : j} />
                ))}
            </ul>
            {more > 0 && !all && (
                <Button variant="ghost" size="sm" className="hi-more" onClick={() => setAll(true)}>
                    <ChevronDown aria-hidden /> Ver {n(more)} más de {name.length > 24 ? 'este juego' : name}
                </Button>
            )}
        </div>
    )
}

/** Un día: fecha, punto con el color de su logro más raro, resumen, hitos y sus juegos. */
function Day({ day, index, ctx }: { day: TimelineDay<Achievement>; index: number; ctx: DayCtx }) {
    const s = daySummary(day)
    const date = parseDayKey(day.day)
    const tag = day.day === ctx.today ? 'Hoy' : day.day === ctx.yesterday ? 'Ayer' : ''
    const high = s.top === 'epica' || s.top === 'leg'
    const notable = notableRarities(s.tiers)
    const style: CSSVars = { '--i': index, '--c': s.top ? rarityColor(s.top) : 'var(--muted)' }
    return (
        <li className={`hi-day${high ? ' is-high' : ''}`} style={style}>
            <p className="hi-day__date" aria-hidden>
                <b>{date.getDate()}</b>
                <span>{WEEKDAY.format(date).replace('.', '')}</span>
                {tag && <em>{tag}</em>}
            </p>
            <div className="hi-day__body">
                <span className="hi-day__dot" title={s.top ? `El más raro del día: ${RARITY_TIER_LABELS[s.top]}` : undefined} />
                <h3 className="hi-day__title">
                    <span className="sr-only">{cap(long(day.day))}: </span>
                    <span>
                        <b>{plural(s.total, 'logro', 'logros')}</b> · {n(s.points)} pts
                    </span>
                    {notable.length > 0 && (
                        <span>
                            {notable.map((r, i) => (
                                <span key={r.tier}>
                                    {i > 0 && ' · '}
                                    <span className="rar-ink" style={{ '--c': rarityColor(r.tier) } as CSSVars}>
                                        {r.label}
                                    </span>
                                </span>
                            ))}
                        </span>
                    )}
                </h3>
                {(ctx.milestones.get(day.day) ?? []).map((m) => {
                    const { tone, Icon } = seriesOf(m.id)
                    return (
                        <p key={m.id} className={`hi-ms hg-tint ${tone}`}>
                            <span className="hi-ms__icon">
                                <Icon aria-hidden />
                            </span>
                            <b>{m.label}</b>
                            <span>· hito</span>
                        </p>
                    )
                })}
                {day.games.map((g) => (
                    <DayGame key={g.appid} day={day.day} entry={g} ctx={ctx} />
                ))}
            </div>
        </li>
    )
}

/**
 * Un mes plegable: resumen (logros, días, puntos, reparto por rareza y sus juegos) y, al abrirlo, sus días. Aparece al
 * llegar a él con el scroll (una vez por visita: `seen` recuerda los que ya se vieron).
 */
function MonthCard({
    month,
    all,
    days,
    open,
    onToggle,
    seen,
    ctx,
}: {
    month: string
    all: TimelineDay<Achievement>[]
    days: TimelineDay<Achievement>[]
    open: boolean
    onToggle: () => void
    seen: Set<string>
    ctx: DayCtx
}) {
    const ref = useRef<HTMLElement>(null)
    const [state, setState] = useState<'wait' | 'seen' | 'shown'>(() => (seen.has(month) ? 'shown' : 'wait'))
    // Los días se pintan la primera vez que se abre y se quedan (para que plegar también se anime).
    const [rendered, setRendered] = useState(open)
    if (open && !rendered) setRendered(true)
    const s = useMemo(() => monthSummary(all), [all])
    const bodyId = `hi-month-${month}`

    useEffect(() => {
        if (state !== 'wait') return
        const el = ref.current
        if (!el || typeof IntersectionObserver === 'undefined') return
        const io = new IntersectionObserver(
            ([e]) => {
                if (!e.isIntersecting) return
                seen.add(month)
                setState('seen')
                io.disconnect()
            },
            { rootMargin: '0px 0px -60px 0px' },
        )
        io.observe(el)
        return () => io.disconnect()
    }, [state, seen, month])

    const covers = s.games.slice(0, 3)
    return (
        <section ref={ref} className={['hi-month', open && 'is-open', state === 'wait' && 'is-wait', state === 'seen' && 'is-seen'].filter(Boolean).join(' ')} aria-label={monthName(month)}>
            <div className="hi-month__head">
                <ChevronRight className="hi-month__chev" aria-hidden />
                <div className="hi-month__title">
                    <div className="hi-month__name">
                        <h2>
                            <button type="button" className="hi-month__btn" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
                                {monthName(month)}
                            </button>
                        </h2>
                        <span className="lg-sec__count">
                            {plural(s.total, 'logro', 'logros')} · {plural(s.days, 'día', 'días')} · {n(s.points)} pts
                        </span>
                    </div>
                    <RaritySummary tiers={s.tiers} total={s.total} />
                </div>
                <span className="hi-month__games" aria-hidden>
                    {covers.map((appid) => (
                        <span key={appid} className="hi-month__cover" title={ctx.gameName(appid)}>
                            <GameCover appid={appid} name={ctx.gameName(appid)} headerImage={ctx.game(appid)?.header_image ?? null} variant="header" sizes="52px" />
                        </span>
                    ))}
                    {s.games.length > 3 && <span>+{s.games.length - 3}</span>}
                </span>
            </div>
            <div className="hi-month__body" id={bodyId}>
                <div className="hi-month__inner">
                    {rendered && (
                        <div className="hi-month__days" inert={!open}>
                            <ol className="hi-days">
                                {days.map((d, i) => (
                                    <Day key={d.day} day={d} index={i} ctx={ctx} />
                                ))}
                            </ol>
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}

/**
 * Historial de logros (#28) con los datos ya cargados: tiles del año y de rachas, mapa del año con el patrón de
 * ActivityHeatmap (pulsable) y línea temporal en meses plegables, con la rareza de cada día y de cada logro.
 */
export default function HistorialView({ data, error, onReload }: { data: HistorialData; error: string; onReload: () => void }) {
    const [now] = useState(() => new Date())
    const today = dayKey(now)
    const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12))

    const d = useMemo(() => {
        const counts = countByDay(data.unlocked)
        const timeline = groupTimeline(data.unlocked)
        const byAppid = new Map(data.games.map((g) => [g.appid, g]))
        return {
            counts,
            timeline,
            months: byMonth(timeline),
            byDay: new Map(timeline.map((t) => [t.day, t])),
            streak: streaks(counts.keys(), now),
            years: yearsWithUnlocks(counts),
            byAppid,
            perfect: perfectDays(data.unlocked, data.games),
            milestones: milestonesByDay(computeMilestones(data.unlocked, data.games).reached),
        }
    }, [data, now])

    const [year, setYear] = useState(() => now.getFullYear())
    const [selected, setSelected] = useState<string | null>(null)
    const [visibleMonths, setVisibleMonths] = useState(MONTHS_STEP)
    const [open, setOpen] = useState<Set<string>>(() => new Set(d.months[0] ? [d.months[0].month] : []))
    const [spot, setSpot] = useState<Streak | null>(null)
    const [swap, setSwap] = useState(0)
    // Meses que ya han aparecido en esta visita: no vuelven a esperar al scroll (al filtrar o al quitar el filtro).
    const [seen] = useState(() => new Set<string>())
    const timelineRef = useRef<HTMLElement>(null)
    const scrollAfterPick = useRef(false)

    const map = useMemo(() => yearHeatmap(year, d.counts, now), [year, d.counts, now])
    const ys = useMemo(() => yearSummary(data.unlocked, d.counts, year), [data.unlocked, d.counts, year])

    // Tras filtrar por un día, la página baja hasta la línea temporal.
    useEffect(() => {
        if (!scrollAfterPick.current) return
        scrollAfterPick.current = false
        timelineRef.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
    }, [swap])

    const ctx: DayCtx = {
        game: (appid) => d.byAppid.get(appid),
        gameName: (appid) => d.byAppid.get(appid)?.name ?? `App ${appid}`,
        perfect: d.perfect,
        milestones: d.milestones,
        today,
        yesterday,
    }

    function rareText(day: string): string {
        const t = d.byDay.get(day)
        return t ? notableRarities(daySummary(t).tiers).map((r) => r.label).join(' · ') : ''
    }

    function pick(day: string) {
        if (!d.byDay.has(day)) return
        const next = selected === day ? null : day
        setSelected(next)
        if (next) {
            const y = Number(next.slice(0, 4))
            if (y !== year) setYear(y)
            setOpen((o) => new Set(o).add(next.slice(0, 7)))
            scrollAfterPick.current = true
        }
        setSwap((s) => s + 1)
    }

    function clear() {
        setSelected(null)
        setSwap((s) => s + 1)
    }

    function toggle(month: string) {
        setOpen((o) => {
            const next = new Set(o)
            if (next.has(month)) next.delete(month)
            else next.add(month)
            return next
        })
    }

    const { current, best } = d.streak
    const risk = streakAtRisk(current, now)
    const lastDay = d.timeline[0]?.day ?? null
    const sameStreak = current.length > 0 && current.start === best.start && current.length === best.length
    const thisYear = now.getFullYear()
    const years = d.years.includes(thisYear) ? d.years : [thisYear, ...d.years]
    const rarest = ys.rarest
    const rarestTier = rarest ? rarityTier(rarest.global_percent) : null

    // Racha resaltada en el mapa (al pasar por su tile): solo si cae en el año que se ve.
    const spotOn = !!spot?.start && !!spot.end && spot.start <= `${year}-12-31` && spot.end >= `${year}-01-01`
    const spotProps = (s: Streak) =>
        s.length > 0
            ? {
                  tabIndex: 0,
                  onMouseEnter: () => setSpot(s),
                  onMouseLeave: () => setSpot(null),
                  onFocus: () => setSpot(s),
                  onBlur: () => setSpot(null),
              }
            : {}

    function decorate(day: HeatDay) {
        const si = streakIndex(day.date, current)
        const cls = [day.date === selected && 'is-selected', si >= 0 && 'is-streak', spotOn && spot && streakIndex(day.date, spot) >= 0 && 'is-spot'].filter(Boolean).join(' ')
        return cls ? { className: cls, style: si >= 0 ? ({ '--s': si } as CSSVars) : undefined } : undefined
    }

    const shownMonths = selected
        ? d.months.filter((m) => m.month === selected.slice(0, 7))
        : d.months.slice(0, visibleMonths)

    let currentNote: ReactNode
    if (risk) {
        currentNote = (
            <span className="hi-risk">
                <TriangleAlert aria-hidden />
                Consigue uno hoy para no perderla
            </span>
        )
    } else if (current.length > 0 && current.start) {
        currentNote = (
            <>
                desde el {short(current.start)} · hoy, <b>{n(d.counts.get(today) ?? 0)}</b>
            </>
        )
    } else if (lastDay) {
        currentNote = `la última acabó el ${short(lastDay)}`
    } else {
        currentNote = 'consigue un logro hoy para empezarla'
    }

    return (
        <div className="logros hi">
            <header className="page-head hg-enter" style={enter(0)}>
                <div>
                    <Link href="/logros" className="logros__back">
                        <ArrowLeft size={14} aria-hidden /> Logros
                    </Link>
                    <h1 className="page-title">Historial</h1>
                    <p className="page-subtitle">
                        {plural(data.unlocked.length, 'logro', 'logros')} en {plural(d.counts.size, 'día', 'días')} distintos.
                    </p>
                </div>
            </header>

            {error && (
                <p className="alert alert--error" role="alert">
                    {error}
                </p>
            )}

            <dl className="hg-tiles lg-tiles hi-tiles hg-enter" style={enter(1)}>
                <Tile icon={<Award aria-hidden />} tone="st-sin_final" label={`Logros en ${year}`}>
                    <dd className="hg-tile__value">
                        <CountUp value={ys.total} />
                    </dd>
                    <dd className="hg-tile__note">
                        {ys.busiest ? (
                            <>
                                en {plural(ys.days, 'día', 'días')} · máx.{' '}
                                <button type="button" className="hi-lk" onClick={() => pick(ys.busiest!.day)} title={`Ver el ${long(ys.busiest.day)}`}>
                                    <b>{n(ys.busiest.count)}</b> el {short(ys.busiest.day)}
                                </button>
                            </>
                        ) : (
                            'ningún día con logros'
                        )}
                    </dd>
                </Tile>

                <div className={`hg-tile st-todos hi-streak ${current.length > 0 ? 'is-hoverable' : 'is-off'}`} {...spotProps(current)}>
                    <dt>
                        <span className="hg-tile__icon hg-tint hi-flame">
                            <Flame aria-hidden />
                        </span>
                        Racha actual
                    </dt>
                    <dd className="hg-tile__value">
                        <CountUp value={current.length} /> <small>{current.length === 1 ? 'día' : 'días'}</small>
                    </dd>
                    <dd className="hg-tile__note">{currentNote}</dd>
                </div>

                <div className={`hg-tile hi-best ${best.length > 0 ? 'is-hoverable' : ''}`} {...spotProps(best)}>
                    <dt>
                        <span className="hg-tile__icon">
                            <Medal aria-hidden />
                        </span>
                        Mejor racha
                    </dt>
                    <dd className="hg-tile__value">
                        <CountUp value={best.length} /> <small>{best.length === 1 ? 'día' : 'días'}</small>
                    </dd>
                    <dd className="hg-tile__note">
                        {best.length === 0 ? (
                            'todavía ninguna'
                        ) : sameStreak && best.start ? (
                            <>
                                <span className="hi-same">Es la actual</span> · desde el {short(best.start)}
                            </>
                        ) : (
                            rangeText(best)
                        )}
                    </dd>
                </div>

                <div className={`hg-tile lg-rare-tile ${rarestTier ? `rar-${rarestTier}` : ''}`} style={rarestTier ? ({ '--c': rarityColor(rarestTier) } as CSSVars) : undefined}>
                    <dt>
                        <span className="hg-tile__icon hg-tint">
                            <Trophy aria-hidden />
                        </span>
                        El más raro de {year}
                    </dt>
                    {rarest && rarestTier ? (
                        <>
                            <dd className="hg-tile__value hg-tile__value--tinted">
                                {formatPercent(rarest.global_percent)} <small>{RARITY_TIER_LABELS[rarestTier]}</small>
                            </dd>
                            <dd className="hg-tile__note" title={`${rarest.display_name ?? rarest.apiname} · ${ctx.gameName(rarest.appid)}`}>
                                <b>{rarest.display_name ?? rarest.apiname}</b> ·{' '}
                                <button type="button" className="hi-lk" onClick={() => pick(rarest.day)} title={`Ver el ${long(rarest.day)}`}>
                                    {short(rarest.day)}
                                </button>{' '}
                                · {ctx.gameName(rarest.appid)}
                            </dd>
                        </>
                    ) : (
                        <>
                            <dd className="hg-tile__value">—</dd>
                            <dd className="hg-tile__note">sin logros este año</dd>
                        </>
                    )}
                </div>
            </dl>

            <div className="hg-enter" style={enter(2)}>
                <ActivityHeatmap
                    key={year}
                    map={map}
                    className="hi-heat"
                    labelledBy="hi-heat-title"
                    gridLabel={`Días de ${year}. Usa las flechas para moverte e Intro para ver los logros de un día.`}
                    gridClass={spotOn ? 'is-spot' : undefined}
                    decorate={decorate}
                    describe={(day) => dayText(day, rareText)}
                    renderTip={(day) => {
                        const extra = rareText(day.date)
                        return day.achievements > 0 ? (
                            <>
                                <b>
                                    {plural(day.achievements, 'logro', 'logros')}
                                    {extra && ` · ${extra}`}
                                </b>
                                <span>{long(day.date)}</span>
                            </>
                        ) : (
                            <>
                                <b>Sin logros</b>
                                <span>{long(day.date)}</span>
                            </>
                        )
                    }}
                    onPick={(day) => pick(day.date)}
                    focusDay={selected}
                    weekdays
                    range={false}
                    startAt={year === thisYear ? 'end' : 'start'}
                    header={
                        <div className="hi-heat__head">
                            <header className="lg-sec__head">
                                <span className="lg-sec__icon hg-tint st-todos" aria-hidden>
                                    <CalendarDays />
                                </span>
                                <h2 id="hi-heat-title" className="lg-sec__title">
                                    Desbloqueos por día
                                </h2>
                                <span className="lg-sec__count">
                                    {plural(map.totals.achievements, 'logro', 'logros')} en {year}
                                </span>
                            </header>
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
                        </div>
                    }
                    footer={<span>Pulsa un día para ver solo sus logros.</span>}
                />
            </div>

            <section ref={timelineRef} className="hi-tl" aria-label="Desbloqueos por día">
                {selected && (
                    <p className="hi-filter">
                        <span>
                            <CalendarDays aria-hidden />
                            Solo el {long(selected)} · <b>{plural(d.counts.get(selected) ?? 0, 'logro', 'logros')}</b>
                        </span>
                        <Button variant="secondary" size="sm" onClick={clear}>
                            <X aria-hidden /> Ver todos los días
                        </Button>
                    </p>
                )}
                <div key={swap} className={swap > 0 ? 'hi-tl__wrap hi-swap' : 'hi-tl__wrap'}>
                    {d.timeline.length === 0 ? (
                        <div className="lg-empty">
                            <span className="lg-empty__icon hg-tint st-sin_final" aria-hidden>
                                <Award />
                            </span>
                            <p>
                                <b>Aún no hay desbloqueos.</b> Cuando consigas logros en Steam y sincronices, aparecerán aquí día a día.
                            </p>
                            <div className="lg-empty__action">
                                <SyncButton label="Sincronizar con Steam" variant="secondary" onSynced={onReload} />
                            </div>
                        </div>
                    ) : (
                        shownMonths.map((m) => (
                            <MonthCard
                                key={m.month}
                                month={m.month}
                                all={m.days}
                                days={selected ? m.days.filter((x) => x.day === selected) : m.days}
                                open={open.has(m.month)}
                                onToggle={() => toggle(m.month)}
                                seen={seen}
                                ctx={ctx}
                            />
                        ))
                    )}
                    {!selected && d.months.length > visibleMonths && (
                        <Button variant="secondary" className="hg-more" onClick={() => setVisibleMonths((v) => v + MONTHS_STEP)}>
                            Ver meses anteriores
                        </Button>
                    )}
                </div>
            </section>
        </div>
    )
}

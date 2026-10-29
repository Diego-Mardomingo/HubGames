'use client'

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, ChevronUp, Equal, List, Medal, MoveHorizontal, Play, Plus, Trophy, UserPlus } from 'lucide-react'
import CountUp from '@/components/CountUp'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/EmptyState'
import { beatPercent } from '@/lib/profile'
import { rankingGap, rankingWindow, TREND_DAYS, type RankingEntry, type RankingTrend } from '@/lib/judi-ranking'

type Trends = Map<string, RankingTrend> | null

const n = (v: number) => v.toLocaleString('es-ES')
const n1 = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const medalClass = (rank: number) => (rank <= 3 ? ` rk-m${rank}` : '')

/** Retrasos de la entrada (ms): el podio sube y luego entran las filas; con tendencia, se ordenan; al final, tu fila. */
const ROWS_AT = 300
const SORT_AT = 520
function findDelay(hasPodium: boolean, sorting: boolean) {
    if (sorting) return 1150
    return hasPodium ? 900 : 650
}

function Avatar({ name, size, self }: { name: string; size: number; self: boolean }) {
    return (
        <span className={`rk-av${self ? ' is-self' : ''}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }} aria-hidden>
            {name[0]?.toUpperCase() || '?'}
        </span>
    )
}

function You() {
    return <span className="rk-you">Tú</span>
}

function TrendChip({ trend, delay }: { trend: RankingTrend; delay?: number }) {
    const style = delay !== undefined ? ({ animationDelay: `${delay}ms` } as CSSProperties) : undefined
    const word = (d: number) => (d === 1 ? 'puesto' : 'puestos')
    if (trend.kind === 'up')
        return (
            <span className="rk-tr is-up hg-pop-in" style={style} title={`Sube ${trend.delta} ${word(trend.delta)} en ${TREND_DAYS} días`}>
                <ChevronUp aria-hidden />
                {trend.delta}
                <span className="sr-only"> {word(trend.delta)} más arriba que hace {TREND_DAYS} días</span>
            </span>
        )
    if (trend.kind === 'down')
        return (
            <span className="rk-tr is-down hg-pop-in" style={style} title={`Baja ${trend.delta} ${word(trend.delta)} en ${TREND_DAYS} días`}>
                <ChevronDown aria-hidden />
                {trend.delta}
                <span className="sr-only"> {word(trend.delta)} más abajo que hace {TREND_DAYS} días</span>
            </span>
        )
    if (trend.kind === 'new')
        return (
            <span className="rk-tr is-new hg-pop-in" style={style} title={`Ha entrado en los últimos ${TREND_DAYS} días`}>
                Nuevo
            </span>
        )
    return (
        <span className="rk-tr is-same" title={`Mismo puesto que hace ${TREND_DAYS} días`}>
            <Equal aria-hidden />
            <span className="sr-only">Mismo puesto que hace {TREND_DAYS} días</span>
        </span>
    )
}

function Gain({ trend }: { trend: RankingTrend }) {
    return (
        <span className="rk-gain">
            <b>+{n(trend.gain)}</b> en {TREND_DAYS} días
        </span>
    )
}

/** «138 acertados · 81 % · media 1,6 intentos», con el empate delante si lo hay. */
function SubLine({ entry }: { entry: RankingEntry }) {
    return (
        <>
            {entry.sharedRank ? (
                <>
                    <b className="rk-tie">Empate</b> ·{' '}
                </>
            ) : entry.pointsTie ? (
                <>
                    <b className="rk-tie">Empate a {n(entry.points)}</b> · desempata por aciertos ·{' '}
                </>
            ) : null}
            {n(entry.wins)} {entry.wins === 1 ? 'acertado' : 'acertados'} · {entry.accuracy} %
            {entry.avgAttempts !== null && <span className="rk-wide"> · media {n1(entry.avgAttempts)} intentos</span>}
        </>
    )
}

/* ── Tus cifras ── */

function SelfTiles({ ranking, me, trend, onFind }: { ranking: RankingEntry[]; me: RankingEntry; trend: RankingTrend | null; onFind: () => void }) {
    const total = ranking.length
    const beat = beatPercent(me.rank, total)
    const gap = rankingGap(ranking, me.userId)
    const medal = me.rank <= 3 ? `rk-m${me.rank}` : ''

    let gapLabel = 'Distancia'
    let gapValue: string | null = null
    let gapNote: ReactNode = null
    if (gap?.kind === 'solo') gapNote = 'Aún no tienes rivales'
    else if (gap?.kind === 'lead') {
        gapLabel = 'Ventaja'
        gapValue = `+${n(gap.points)}`
        gapNote = (
            <>
                sobre <b>{gap.other.username}</b>, el {gap.other.rank}.º
            </>
        )
    } else if (gap?.kind === 'tie') {
        gapValue = '0'
        gapNote = (
            <>
                Empatas a puntos con <b>{gap.other.username}</b>
            </>
        )
    } else if (gap?.kind === 'behind') {
        gapValue = n(gap.points)
        gapNote = (
            <>
                te faltan para pasar a <b>{gap.other.username}</b> ({gap.other.rank}.º)
            </>
        )
    }

    return (
        <dl className="hg-tiles rk-tiles">
            <div className={`hg-tile hg-enter ${medal || 'st-todos'}`} style={{ '--i': 1 } as CSSProperties}>
                <dt>
                    <span className={`hg-tile__icon ${medal ? 'rk-medal-tint' : 'hg-tint'}`}>
                        <Medal aria-hidden />
                    </span>
                    Tu puesto
                </dt>
                <dd className={`hg-tile__value${medal ? ' rk-medal-ink' : ''}`}>
                    {me.rank}.º <small>de {n(total)}</small>
                </dd>
                <dd className="hg-tile__note">
                    {beat === null ? 'Eres el único jugador' : (
                        <>
                            Superas al <b>{beat} %</b>
                        </>
                    )}{' '}
                    ·{' '}
                    <button type="button" className="rk-tile-link" onClick={onFind}>
                        Ver tu fila
                    </button>
                </dd>
            </div>
            <div className="hg-tile st-todos hg-enter" style={{ '--i': 2 } as CSSProperties}>
                <dt>
                    <span className="hg-tile__icon hg-tint">
                        <Trophy aria-hidden />
                    </span>
                    Puntos
                </dt>
                <dd className="hg-tile__value">
                    <CountUp value={me.points} />
                </dd>
                <dd className="hg-tile__note">
                    {trend ? (
                        <>
                            <b>+{n(trend.gain)}</b> en {TREND_DAYS} días
                        </>
                    ) : (
                        <>de {n(me.finishedGames)} {me.finishedGames === 1 ? 'partida' : 'partidas'}</>
                    )}
                </dd>
            </div>
            <div className="hg-tile st-todos hg-enter" style={{ '--i': 3 } as CSSProperties}>
                <dt>
                    <span className="hg-tile__icon hg-tint">
                        <MoveHorizontal aria-hidden />
                    </span>
                    {gapLabel}
                </dt>
                <dd className="hg-tile__value">
                    {gapValue === null ? '—' : (
                        <>
                            {gapValue} <small>pts</small>
                        </>
                    )}
                </dd>
                <dd className="hg-tile__note">{gapNote}</dd>
            </div>
            <div className="hg-tile rk-ok hg-enter" style={{ '--i': 4 } as CSSProperties}>
                <dt>
                    <span className="hg-tile__icon hg-tint">
                        <Check aria-hidden />
                    </span>
                    Acertados
                </dt>
                <dd className="hg-tile__value">
                    <CountUp value={me.wins} /> <small>{me.accuracy} %</small>
                </dd>
                <dd className="hg-tile__note">
                    de {n(me.finishedGames)}
                    {me.avgAttempts !== null && <> · media {n1(me.avgAttempts)} intentos</>}
                </dd>
            </div>
        </dl>
    )
}

/* ── Podio escalonado: sube el 3.º, luego el 2.º y el 1.º ── */

const RISE_ORDER: Record<number, number> = { 3: 0, 2: 1, 1: 2 }

function Podium({ ranking, userId, trends }: { ranking: RankingEntry[]; userId: string | null; trends: Trends }) {
    const slots = [0, 1, 2].map((i) => ranking[i] ?? null)
    return (
        <ol className="rk-pd" aria-label="Podio">
            {slots.map((entry, i) => {
                const slot = i + 1
                const style = { '--o': RISE_ORDER[slot] } as CSSProperties
                if (!entry) {
                    return (
                        <li key={`libre-${slot}`} className={`rk-pd__col rk-pd__col--${slot} rk-m${slot} is-empty`} style={style}>
                            <div className="rk-pd__card">
                                <span className="rk-medal rk-medal--lg" aria-hidden>
                                    {slot}
                                </span>
                                <span className="rk-pd__empty-av" aria-hidden>
                                    <Plus />
                                </span>
                                <span className="rk-pd__empty-t">Libre</span>
                                <span className="rk-pd__empty-s">Termina un JUDI para subir</span>
                            </div>
                            <div className="rk-pd__step" aria-hidden>
                                <b>{slot}</b>
                            </div>
                        </li>
                    )
                }
                const self = entry.userId === userId
                const trend = trends?.get(entry.userId) ?? null
                return (
                    <li
                        key={entry.userId}
                        className={`rk-pd__col rk-pd__col--${slot}${medalClass(Math.min(entry.rank, 3))}${self ? ' is-self' : ''}`}
                        style={style}
                        data-self={self || undefined}
                    >
                        <div className="rk-pd__card">
                            <span className="rk-medal rk-medal--lg" aria-label={`Puesto ${entry.rank}`}>
                                {entry.rank}
                            </span>
                            <span className="rk-pd__av">
                                <Avatar name={entry.username} size={slot === 1 ? 60 : 50} self={self} />
                            </span>
                            <span className="rk-pd__name" title={entry.username}>
                                <span>{entry.username}</span>
                                {self && <You />}
                            </span>
                            <span className="rk-pd__pts">
                                <b>
                                    <CountUp value={entry.points} />
                                </b>
                                puntos
                            </span>
                            <span className="rk-pd__sub">
                                <SubLine entry={entry} />
                            </span>
                            {trend && (
                                <span className="rk-pd__meta">
                                    <TrendChip trend={trend} delay={900} />
                                    <span className="rk-pd__gain">
                                        <Gain trend={trend} />
                                    </span>
                                </span>
                            )}
                        </div>
                        <div className="rk-pd__step" aria-hidden>
                            <b>{entry.rank}</b>
                        </div>
                    </li>
                )
            })}
        </ol>
    )
}

/* ── Clasificación ── */

function Row({ entry, self, top, trend, index, from }: { entry: RankingEntry; self: boolean; top: number; trend: RankingTrend | null; index: number; from: number }) {
    const pct = top > 0 ? (entry.points / top) * 100 : 0
    const sorting = from !== 0
    const style = { '--i': index, '--from': from } as CSSProperties
    return (
        <li className={`rk-row${medalClass(entry.rank)}${self ? ' is-self' : ''}${sorting ? ' is-sorting' : ''}`} style={style} data-self={self || undefined}>
            <span className="rk-row__rank" aria-label={`Puesto ${entry.rank}${entry.sharedRank ? ', empatado' : ''}`}>
                {entry.rank <= 3 ? (
                    <span className="rk-medal">{entry.rank}</span>
                ) : (
                    <>
                        {entry.sharedRank && <small aria-hidden>=</small>}
                        {entry.rank}
                    </>
                )}
            </span>
            <Avatar name={entry.username} size={36} self={self} />
            <span className="rk-row__player">
                <span className="rk-row__name" title={entry.username}>
                    <span>{entry.username}</span>
                    {self && <You />}
                </span>
                <span className="rk-row__sub">
                    <SubLine entry={entry} />
                </span>
            </span>
            <span className="hg-bar hg-bar--fill rk-row__bar" style={{ '--i': index } as CSSProperties} aria-hidden>
                <span style={{ width: `${pct}%` }} />
            </span>
            <span className="rk-row__end">
                <span className="rk-row__pts">
                    {n(entry.points)}
                    <small> pts</small>
                </span>
                {trend && (
                    <span className="rk-row__trend">
                        <TrendChip trend={trend} delay={sorting ? SORT_AT + 520 : ROWS_AT + 300 + Math.min(index, 8) * 30} />
                        <span className="rk-row__gain">
                            <Gain trend={trend} />
                        </span>
                    </span>
                )}
            </span>
        </li>
    )
}

export function RankingList({ ranking, userId, trends, skip, all, onAll }: { ranking: RankingEntry[]; userId: string | null; trends: Trends; skip: number; all: boolean; onAll: () => void }) {
    const { items, truncated } = useMemo(() => rankingWindow(ranking, userId, { all }), [ranking, userId, all])
    const visible = items.filter((it) => it.kind === 'gap' || it.index >= skip)
    // Quita un «···» que se quede al principio (el top ya está en el podio)
    while (visible[0]?.kind === 'gap') visible.shift()
    const entries = visible.flatMap((it) => (it.kind === 'entry' ? [it.entry] : []))

    // Orden de hace 30 días entre las filas a la vista (para deslizarlas a su puesto de hoy al cargar)
    const fromOf = sortOffsets(entries, trends, !truncated && !all)

    if (!entries.length) return null
    const top = ranking[0]?.points ?? 0
    let i = 0
    return (
        <>
            <ol className="rk-list" aria-label="Clasificación">
                {visible.map((it) => {
                    if (it.kind === 'gap')
                        return (
                            <li key={it.key} className="rk-gap" aria-hidden>
                                ···
                            </li>
                        )
                    const index = i++
                    return (
                        <Row
                            key={it.entry.userId}
                            entry={it.entry}
                            self={it.entry.userId === userId}
                            top={top}
                            trend={trends?.get(it.entry.userId) ?? null}
                            index={index}
                            from={fromOf.get(it.entry.userId) ?? 0}
                        />
                    )
                })}
            </ol>
            {truncated && (
                <Button variant="secondary" size="sm" className="rk-more" onClick={onAll}>
                    <List data-icon="inline-start" aria-hidden /> Ver los {n(ranking.length)}
                </Button>
            )}
        </>
    )
}

/**
 * Cuántas filas hay que desplazar cada una para que empiece en su puesto de hace 30 días (0 = no se mueve). Solo con
 * tendencia y la lista entera a la vista (con «···» el orden de antes no cabe en pantalla).
 */
function sortOffsets(entries: RankingEntry[], trends: Trends, enabled: boolean): Map<string, number> {
    const map = new Map<string, number>()
    if (!trends || !enabled) return map
    const before = [...entries].sort((a, b) => {
        const pa = trends.get(a.userId)?.previousRank ?? Infinity
        const pb = trends.get(b.userId)?.previousRank ?? Infinity
        return pa - pb || entries.indexOf(a) - entries.indexOf(b)
    })
    entries.forEach((e, i) => map.set(e.userId, before.indexOf(e) - i))
    return map
}

/* ── Página ── */

export default function RankingView({ ranking, userId, trends }: { ranking: RankingEntry[]; userId: string | null; trends: Trends }) {
    const root = useRef<HTMLDivElement>(null)
    const [all, setAll] = useState(false)
    const me = userId ? ranking.find((e) => e.userId === userId) ?? null : null
    const hasPodium = ranking.length > 0
    const sorting = [...sortOffsets(ranking.slice(3), trends, ranking.length < 15).values()].some((v) => v !== 0)
    const rest = ranking.length - Math.min(3, ranking.length)

    const find = () => {
        const target = root.current?.querySelector<HTMLElement>('[data-self]')
        if (!target) return
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        target.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
        const next = target.classList.contains('is-found-a') ? 'is-found-b' : 'is-found-a'
        target.classList.remove('is-found-a', 'is-found-b')
        target.classList.add(next)
    }

    return (
        <div className="rk" ref={root} style={{ '--find-at': `${findDelay(hasPodium, sorting)}ms` } as CSSProperties}>
            <header className="page-head rk-head hg-enter">
                <div>
                    <h1 className="page-title">Ranking</h1>
                    <p className="page-subtitle">Cuanto antes aciertes el juego del día, más puntos sumas.</p>
                    <p className="rk-rules">
                        <span>Puntos por intento</span>
                        <span className="rk-rules__pts" aria-label="6 puntos al primer intento, 1 al sexto">
                            {[6, 5, 4, 3, 2, 1].map((p) => (
                                <span key={p} aria-hidden>
                                    +{p}
                                </span>
                            ))}
                        </span>
                        <span>· fallar no suma</span>
                    </p>
                </div>
            </header>

            {ranking.length === 0 ? (
                <EmptyState
                    size="page"
                    tone="rk-m1 rk-medal-tint"
                    icon={<Trophy />}
                    title="Aún no hay clasificación"
                    className="hg-enter"
                    style={{ '--i': 1 } as CSSProperties}
                    action={
                        <Button asChild>
                            <Link href="/judi">
                                <Play data-icon="inline-start" aria-hidden /> Jugar el de hoy
                            </Link>
                        </Button>
                    }
                >
                    Nadie ha terminado un JUDI. El primero que lo haga se queda el oro.
                </EmptyState>
            ) : (
                <>
                    {me ? (
                        <SelfTiles ranking={ranking} me={me} trend={trends?.get(me.userId) ?? null} onFind={find} />
                    ) : (
                        <div className="rk-nudge hg-enter" style={{ '--i': 1 } as CSSProperties}>
                            <span className="rk-nudge__icon hg-tint st-todos" aria-hidden>
                                <UserPlus />
                            </span>
                            <p>
                                <b>Aún no estás en el ranking.</b> Termina un JUDI (aciertes o no) para entrar.
                            </p>
                            <Button asChild size="sm">
                                <Link href="/judi">
                                    <Play data-icon="inline-start" aria-hidden /> Jugar el de hoy
                                </Link>
                            </Button>
                        </div>
                    )}

                    <Podium ranking={ranking} userId={userId} trends={trends} />

                    {rest > 0 && (
                        <section className="rk-sec" aria-labelledby="rk-list-title">
                            <header className="rk-sec__head hg-enter" style={{ '--i': 6 } as CSSProperties}>
                                <span className="rk-sec__icon hg-tint st-todos" aria-hidden>
                                    <List />
                                </span>
                                <h2 id="rk-list-title">Clasificación</h2>
                                <span className="rk-sec__count">
                                    {n(ranking.length)} {ranking.length === 1 ? 'jugador' : 'jugadores'}
                                </span>
                                {trends && <span className="rk-sec__end">Tendencia: puesto de hoy frente al de hace {TREND_DAYS} días de JUDI</span>}
                            </header>
                            <RankingList ranking={ranking} userId={userId} trends={trends} skip={3} all={all} onAll={() => setAll(true)} />
                        </section>
                    )}
                    {rest === 0 && trends && <p className="rk-foot">Tendencia: puesto de hoy frente al de hace {TREND_DAYS} días de JUDI.</p>}
                </>
            )}
        </div>
    )
}

'use client'

import type { CSSProperties, ReactNode } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ArrowRight, Check, ChevronDown, Play, SkipForward, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { attemptSlots, pointsAtStake, type JudiAttempt, type JudiDayState, type JudiStatDay } from '@/lib/judi'
import { AttemptPips } from './JudiAttempts'

/** Un día del historial de /judi: lo de `JudiStatDay` más lo que se enseña en la fila. */
export type JudiHistoryDay = JudiStatDay & {
    id: number
    nombre: string | null
    headerImage: string | null
    points: number
    /** Intentos en orden (si `exact`) o tantos fallos sin nombre como intentos gastaste. */
    attempts: JudiAttempt[]
    /** Nombres que se conocen (en partidas sin orden, los que se guardaron). */
    names: string[]
    exact: boolean
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const
const WEEKDAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const WEEKDAY_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function parts(date: string) {
    const [y, m, d] = date.split('-').map(Number)
    return { y, m: m - 1, d, wd: new Date(y, m - 1, d, 12).getDay() }
}

/** «26 de octubre» */
export function judiDayLong(date: string): string {
    const p = parts(date)
    return `${p.d} de ${MONTHS[p.m]}`
}

/** «lun 26 oct» */
export function judiDayShort(date: string): string {
    const p = parts(date)
    return `${WEEKDAY_SHORT[p.wd]} ${p.d} ${MONTHS[p.m].slice(0, 3)}`
}

/** Estado de la partida para `attemptSlots`. */
export function dayState(day: Pick<JudiStatDay, 'status'>): JudiDayState {
    return day.status === 'won' ? 'won' : day.status === 'lost' ? 'lost' : 'playing'
}

/** Qué pasó ese día, en una frase corta con su icono. */
export function DayResult({ day }: { day: JudiHistoryDay }) {
    if (day.status === 'won')
        return (
            <span className="jd-day__res jd-ok">
                <Check aria-hidden strokeWidth={3} />
                {day.failed === 0 ? 'Acertado a la primera' : `Acertado en el intento ${day.failed + 1}`}
            </span>
        )
    if (day.status === 'lost')
        return (
            <span className="jd-day__res jd-ko">
                <X aria-hidden strokeWidth={3} />
                Fallado
            </span>
        )
    if (day.status === 'progress')
        return (
            <span className="jd-day__res jd-ac">
                <Play aria-hidden strokeWidth={2.5} />
                En curso · quedan {6 - day.failed}
            </span>
        )
    return <span>+{pointsAtStake(0)} si aciertas</span>
}

function count(n: number, one: string, many: string) {
    return `${n} ${n === 1 ? one : many}`
}

/** Lo que se ve al desplegar: «Tus intentos» en orden o, en partidas sin orden, los nombres que se conocen. */
function DayDetail({ day, onPlay }: { day: JudiHistoryDay; onPlay: () => void }) {
    const misses = day.attempts.filter((a) => a.kind === 'miss').length
    const skips = day.attempts.length - misses
    let note: ReactNode
    if (day.exact) {
        note =
            day.status === 'won'
                ? day.failed === 0
                    ? 'Con solo la primera captura.'
                    : `Tras ${[misses && count(misses, 'fallo', 'fallos'), skips && count(skips, 'saltado', 'saltados')].filter(Boolean).join(' y ')}.`
                : day.status === 'lost'
                  ? 'Sin dar con él en los 6 intentos.'
                  : `Llevas ${count(day.failed, 'intento', 'intentos')}; puedes seguir cuando quieras.`
    } else {
        note = (
            <>
                <b>Sin orden</b>: {count(day.failed, 'intento sin acertar', 'intentos sin acertar')}. De esta partida no se guardaron los saltos
                {day.status === 'won' ? ' ni los fallos (antes se borraban al acertar)' : ''}
                {day.names.length ? '; estos son los nombres que quedan' : ''}.
            </>
        )
    }
    const p = parts(day.date)
    return (
        <div className="jd-day__dbody">
            <p className="jd-day__dnote">{note}</p>
            <ul className="jd-tries__list jd-day__tries" aria-label="Tus intentos">
                {day.exact
                    ? day.attempts.map((a, i) => (
                          <li key={i} className={`jd-try jd-try--${a.kind}`}>
                              <span className="jd-try__icon">{a.kind === 'miss' ? <X aria-hidden strokeWidth={3} /> : <SkipForward aria-hidden strokeWidth={3} />}</span>
                              <span className="jd-try__name">
                                  {i + 1}.º · {a.kind === 'miss' ? a.name : 'Saltado'}
                              </span>
                          </li>
                      ))
                    : day.names.map((name, i) => (
                          <li key={`${name}-${i}`} className="jd-try jd-try--miss">
                              <span className="jd-try__icon">
                                  <X aria-hidden strokeWidth={3} />
                              </span>
                              <span className="jd-try__name">{name}</span>
                          </li>
                      ))}
                {day.status === 'won' && (
                    <li className="jd-try jd-try--hit">
                        <span className="jd-try__icon">
                            <Check aria-hidden strokeWidth={3} />
                        </span>
                        <span className="jd-try__name">
                            {day.failed + 1}.º · {day.nombre}
                        </span>
                    </li>
                )}
            </ul>
            <div className="jd-day__dfoot">
                <span className="jd-day__dnote">
                    JUDI #{day.id} · {WEEKDAY_LONG[p.wd]}, {judiDayLong(day.date)}
                </span>
                <Button variant="secondary" size="sm" onClick={onPlay}>
                    {day.status === 'progress' ? 'Seguir la partida' : 'Ver la partida'}
                    <ArrowRight data-icon="inline-end" aria-hidden />
                </Button>
            </div>
        </div>
    )
}

/**
 * Un día del historial: franja con su color, fecha, cápsula (o «?» si no lo has terminado: el nombre no se revela),
 * qué pasó, los 6 intentos (`AttemptPips`) y los puntos. Se despliega para ver «Tus intentos». Pulsar la fila abre la
 * partida.
 */
export default function JudiDayRow({
    day,
    index,
    isToday,
    open,
    onToggle,
    onPlay,
    flash,
}: {
    day: JudiHistoryDay
    /** Posición en el mes, para la entrada escalonada (`.hg-enter`). */
    index: number
    isToday: boolean
    open: boolean
    onToggle: () => void
    onPlay: () => void
    /** Se acaba de llegar a este día desde el mapa. */
    flash: boolean
}) {
    const reduce = useReducedMotion()
    const p = parts(day.date)
    const done = day.status === 'won' || day.status === 'lost'
    const name = done ? (day.nombre ?? 'Sin nombre') : day.status === 'progress' ? '¿Lo reconoces?' : 'Sin jugar'
    const label = `JUDI #${day.id}, ${judiDayShort(day.date)}: ${
        done ? `${name}, ${day.status === 'won' ? `acertado en el intento ${day.failed + 1}` : 'fallado'}` : day.status === 'progress' ? 'en curso' : 'sin jugar'
    }`
    const slots = day.status === 'new' ? null : attemptSlots(dayState(day), day.attempts)
    const pts =
        day.status === 'won' ? <span className="jd-day__pts jd-ok">+{day.points}</span> : day.status === 'lost' ? <span className="jd-day__pts is-zero">0</span> : <span className="jd-day__pts" />
    const detailId = `jd-day-${day.id}-detail`

    return (
        <li
            id={`jd-day-${day.id}`}
            className={['jd-day hg-enter', `is-${day.status}`, isToday && 'is-today', open && 'is-open', flash && 'is-flash'].filter(Boolean).join(' ')}
            style={{ '--i': index } as CSSProperties}
        >
            <div className="jd-day__row">
                <span className="jd-day__date">
                    <b>{p.d}</b>
                    <span>{WEEKDAY_SHORT[p.wd]}</span>
                    {isToday && <span className="jd-day__today">Hoy</span>}
                </span>
                <span className="jd-day__cover">
                    {done && day.headerImage ? (
                        <img src={day.headerImage} alt="" loading="lazy" draggable={false} />
                    ) : (
                        <span className="jd-mystery" aria-hidden>
                            <span>?</span>
                        </span>
                    )}
                </span>
                <span className="jd-day__main">
                    <button type="button" className={`jd-day__name${done ? '' : ' is-q'}`} onClick={onPlay} aria-label={label}>
                        {name}
                    </button>
                    <span className="jd-day__meta">
                        <DayResult day={day} />
                        <span className="jd-day__id">#{day.id}</span>
                    </span>
                    {slots && (
                        <span className="jd-day__sub">
                            <AttemptPips slots={slots} size="sm" />
                            {pts}
                        </span>
                    )}
                </span>
                {slots ? (
                    <>
                        <span className="jd-day__pips">
                            <AttemptPips slots={slots} size="sm" />
                        </span>
                        {pts}
                        <button
                            type="button"
                            className="jd-day__more"
                            onClick={onToggle}
                            aria-expanded={open}
                            aria-controls={detailId}
                            aria-label={`${open ? 'Ocultar' : 'Ver'} tus intentos del #${day.id}`}
                        >
                            <ChevronDown aria-hidden />
                        </button>
                    </>
                ) : (
                    <Button variant={isToday ? 'default' : 'secondary'} size="sm" className="jd-day__act" onClick={onPlay}>
                        Jugar
                    </Button>
                )}
            </div>
            <AnimatePresence initial={false}>
                {open && slots && (
                    <motion.div
                        key="detail"
                        id={detailId}
                        className="jd-day__detail"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={reduce ? { duration: 0 } : { height: { duration: 0.26, ease: EASE_OUT }, opacity: { duration: 0.2 } }}
                    >
                        <DayDetail day={day} onPlay={onPlay} />
                    </motion.div>
                )}
            </AnimatePresence>
        </li>
    )
}

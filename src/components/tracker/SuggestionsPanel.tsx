'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Award, Check, ChevronDown, CircleHelp, Clock, ThumbsUp, Undo2 } from 'lucide-react'
import {
    dismissSuggestion,
    restoreGames,
    restoreSuggestion,
    setGamesStatus,
    statusSnapshot,
    STATUS_LABELS,
    type LibraryGame,
    type StatusSnapshot,
} from '@/lib/tracker'
import type { Suggestion } from '@/lib/tracker-rules'
import {
    daysAgo,
    dismissReason,
    formatHoursExact,
    goalBar,
    goalPhrase,
    groupSuggestions,
    limitGroups,
    parseSuggestion,
    suggestionEvidence,
    SUGGESTION_COPY,
    SUGGESTIONS_VISIBLE,
    type SuggestionEvidence,
} from '@/lib/suggestions'
import { metacriticScore, steamReviewScore } from '@/lib/scores'
import { Button } from '@/components/ui/button'
import AnimatedCount from '@/components/AnimatedCount'
import CountUp from '@/components/CountUp'
import { announceListMove, listShortcut } from '@/components/dashboard/ListShortcuts'
import CompleteDialog from './CompleteDialog'
import GameCover from './GameCover'
import { LIST_ICONS, MarkFlags, StatusChip } from './status'
import './tracker.css'

type CSSVars = CSSProperties & Record<`--${string}`, string | number>

/** Tinte de la fila antes de salir, aviso de Deshacer, «Todo al día» antes de plegarse y el pliegue. */
const TINT_MS = 200
const TOAST_MS = 5000
const DONE_MS = 1400
const CLOSE_MS = 300
const EASE_OUT = [0.22, 1, 0.36, 1] as const

const SHORT_DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' })
const shortDate = (iso: string) => SHORT_DATE.format(new Date(iso)).replace('.', '')

type Toast =
    | { id: number; type: 'pausado'; game: LibraryGame; snapshot: StatusSnapshot }
    | { id: number; type: 'descartado'; game: LibraryGame; evidence: SuggestionEvidence | null }

interface Flight {
    id: number
    kind: Suggestion
    from: { x: number; y: number }
    to: { x: number; y: number }
    /** Al llegar: el contador del atajo sube. */
    land: () => void
}

/** Anillo de logros (el de la ficha, en pequeño): se cierra al llegar. */
function Ring({ value }: { value: number }) {
    return (
        <svg className="sg-ring" viewBox="0 0 18 18" aria-hidden>
            <circle className="sg-ring__track" cx="9" cy="9" r="7" />
            <circle className="sg-ring__fill" cx="9" cy="9" r="7" style={{ strokeDashoffset: 44 * (1 - Math.min(1, value)) }} />
        </svg>
    )
}

/** Barra frente a la meta: cobalto hasta llegar, verde al pasarla; la marca es la meta. */
function GoalBar({ minutes, target, mark = true }: { minutes: number; target: number; mark?: boolean }) {
    const b = goalBar(minutes, target)
    return (
        <span className={`sg-bar${b.over ? ' is-over' : ''}`} style={{ '--f': b.fill.toFixed(3), '--m': b.mark.toFixed(3) } as CSSVars} aria-hidden>
            <span />
            {mark && b.over && <i />}
        </span>
    )
}

/** La prueba: por qué te lo preguntamos, con el color de lo que demuestra. */
function Evidence({ ev }: { ev: SuggestionEvidence }) {
    if (ev.why === 'logros') {
        return (
            <>
                <span className="sg-ev__item sg-ev--done">
                    <Ring value={1} />
                    <span className="sg-ev__txt">
                        <b>
                            {ev.unlocked} de {ev.total} logros
                        </b>
                    </span>
                </span>
                {ev.daysSinceUnlock !== null && <span className="sg-ev__sub">el último, {daysAgo(ev.daysSinceUnlock)}</span>}
            </>
        )
    }
    if (ev.why === 'horas') {
        return (
            <>
                <span className="sg-ev__item sg-ev--done" title="Duración según HowLongToBeat">
                    <GoalBar minutes={ev.minutes} target={ev.targetMinutes} />
                    <span className="sg-ev__txt">
                        <b>{formatHoursExact(ev.minutes)}</b> de {formatHoursExact(ev.targetMinutes)} <span className="sg-long">{goalPhrase(ev.goal)}</span>
                        <span className="sg-short">{goalPhrase(ev.goal, true)}</span>
                    </span>
                </span>
                {ev.minutes > ev.targetMinutes && <span className="sg-plus hg-tint st-completado">+{formatHoursExact(ev.minutes - ev.targetMinutes)}</span>}
            </>
        )
    }
    if (ev.why === 'inactivo') {
        return (
            <>
                <span className="sg-ev__item sg-ev--idle">
                    <Clock aria-hidden />
                    <span className="sg-ev__txt">
                        <b>
                            <CountUp value={ev.idleDays} suffix={ev.idleDays === 1 ? 'día' : 'días'} />
                        </b>{' '}
                        sin jugar
                    </span>
                </span>
                {ev.since && <span className="sg-ev__sub">desde el {shortDate(ev.since)}</span>}
                {ev.storyMinutes !== null && (
                    <span className="sg-ev__item" title="Dónde lo dejaste (HowLongToBeat)">
                        <GoalBar minutes={ev.minutes} target={ev.storyMinutes} mark={false} />
                        <span className="sg-ev__sub">
                            {formatHoursExact(ev.minutes)} de {formatHoursExact(ev.storyMinutes)} de historia
                        </span>
                    </span>
                )}
            </>
        )
    }
    return null
}

/** Contexto: dónde está ahora, horas, logros, última partida y puntuaciones con su color. Sin precios: son juegos comprados. */
function Context({ game, ev, now }: { game: LibraryGame; ev: SuggestionEvidence | null; now: number }) {
    const why = ev?.why ?? 'otro'
    const showHours = why === 'logros' || why === 'otro' || (ev?.why === 'inactivo' && ev.storyMinutes === null)
    const total = game.achievements_total ?? 0
    const mc = game.metacritic_score !== null ? metacriticScore(game.metacritic_score) : null
    const rev = game.steamspy_userscore ? steamReviewScore(game.steamspy_userscore) : null
    const lastDays = game.rtime_last_played ? Math.max(0, Math.floor((now - Date.parse(game.rtime_last_played)) / 86_400_000)) : null
    return (
        <span className="sg-ctx">
            <span className="sg-now">
                Ahora en <StatusChip status={game.status} />
            </span>
            {showHours && (
                <span className="sg-m">
                    <Clock aria-hidden />
                    <b>{formatHoursExact(game.playtime_forever)}</b>
                </span>
            )}
            {why !== 'logros' && total > 0 && (
                <span className="sg-m" title="Logros">
                    <Award aria-hidden />
                    {game.achievements_unlocked ?? 0} / {total}
                    <span className="sr-only"> logros</span>
                </span>
            )}
            {why === 'horas' && lastDays !== null && <span className="sg-m sg-m--last">Última partida {daysAgo(lastDays)}</span>}
            {mc && (
                <span className={`hg-score hg-tint sc-${mc.tier} sg-mc`} title={`Metacritic: ${mc.label}`}>
                    {game.metacritic_score}
                    <span className="sr-only"> en Metacritic ({mc.label})</span>
                </span>
            )}
            {rev && (
                <span className={`sg-rev hg-tint sc-${rev.tier}`} title={`Reseñas de Steam: ${rev.label}`}>
                    <ThumbsUp aria-hidden />
                    <b>{Math.round(game.steamspy_userscore!)} %</b>
                    <span className="sg-rev__label">{rev.label}</span>
                </span>
            )}
        </span>
    )
}

/** Ficha con el icono y el nombre de la lista que vuela del botón al atajo de esa lista en la cabecera del Inicio (440 ms). */
function FlyingChip({ flight, onDone }: { flight: Flight; onDone: (f: Flight) => void }) {
    const ref = useRef<HTMLSpanElement>(null)
    useEffect(() => {
        const el = ref.current
        if (!el) return
        const dx = flight.to.x - flight.from.x - el.offsetWidth / 2
        const dy = flight.to.y - flight.from.y - el.offsetHeight / 2
        const anim = el.animate(
            [
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                { transform: `translate(${dx * 0.6}px, ${dy * 0.6}px) scale(0.85)`, opacity: 1, offset: 0.65 },
                { transform: `translate(${dx}px, ${dy}px) scale(0.7)`, opacity: 0 },
            ],
            { duration: 440, easing: 'cubic-bezier(.5, 0, .2, 1)', fill: 'forwards' },
        )
        anim.onfinish = () => onDone(flight)
        return () => anim.cancel()
    }, [flight, onDone])
    const Icon = LIST_ICONS[flight.kind]
    return (
        <span ref={ref} className={`sg-token st-${flight.kind}`} style={{ left: flight.from.x, top: flight.from.y }} aria-hidden>
            <Icon />
            {STATUS_LABELS[flight.kind]}
        </span>
    )
}

/**
 * Sugerencias de la sincronización (#18) en el Inicio: «¿Lo has terminado?» y «¿Lo dejas en pausa?», agrupadas por la
 * lista de destino y con la prueba de por qué se pregunta (las reglas de `evaluateGame`). Responder tiñe la fila del color
 * de su lista y una ficha vuela a su atajo en la cabecera; pausar y descartar se pueden deshacer durante 5 s.
 * Mockup: docs/mockups/sugerencias.html.
 */
export default function SuggestionsPanel({ games: initial, now }: { games: LibraryGame[]; now: number }) {
    const reduce = useReducedMotion()
    const titleId = useId()
    // Lo que trae el servidor; al recargar (sincronizar) se vuelve a empezar con lo nuevo.
    const sourceKey = initial.map((g) => `${g.appid}:${g.suggestion}`).join(',')
    const [source, setSource] = useState(sourceKey)
    const [list, setList] = useState(initial)
    const [answered, setAnswered] = useState(false)
    const [closing, setClosing] = useState(false)
    const [closed, setClosed] = useState(false)
    if (source !== sourceKey) {
        setSource(sourceKey)
        setList(initial)
        setAnswered(false)
        setClosing(false)
        setClosed(false)
    }

    const [expanded, setExpanded] = useState(false)
    const [entered, setEntered] = useState(false)
    const [leaving, setLeaving] = useState<Map<number, 'going' | 'dismiss'>>(new Map())
    const [back, setBack] = useState<Set<number>>(new Set())
    /** Respuesta guardándose ("123:pausar", "123:descartar"): su botón gira y los de ese juego esperan. */
    const [pending, setPending] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [completing, setCompleting] = useState<LibraryGame | null>(null)
    const [toast, setToast] = useState<Toast | null>(null)
    const [flights, setFlights] = useState<Flight[]>([])
    /** Completado en el diálogo: sale de la lista al cerrarlo, tras la celebración. */
    const completedRef = useRef<LibraryGame | null>(null)
    const sectionRef = useRef<HTMLElement>(null)
    /** Posición del resto del Inicio antes de quitar el panel, para que suba sin saltar (FLIP). */
    const flipRef = useRef<Map<Element, number> | null>(null)
    const seq = useRef(0)

    const evidence = useMemo(() => new Map(list.map((g) => [g.appid, suggestionEvidence(g, now)])), [list, now])
    const groups = useMemo(() => groupSuggestions(list), [list])
    const { groups: shown, hidden } = limitGroups(groups, expanded ? Infinity : SUGGESTIONS_VISIBLE)
    const one = list.length === 1
    const empty = list.length === 0

    // La entrada (filas escalonadas, anillos, barras y días que cuentan) solo al llegar.
    useEffect(() => {
        const t = setTimeout(() => setEntered(true), 900)
        return () => clearTimeout(t)
    }, [])

    // El aviso de Deshacer dura 5 s.
    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast((x) => (x?.id === toast.id ? null : x)), TOAST_MS)
        return () => clearTimeout(t)
    }, [toast])

    // Última respuesta: «Todo al día» con el check que se dibuja; luego el panel se desvanece y el resto del Inicio sube.
    useEffect(() => {
        if (!empty || !answered || closed) return
        const t1 = setTimeout(() => setClosing(true), reduce ? 0 : DONE_MS)
        const t2 = setTimeout(
            () => {
                const section = sectionRef.current
                if (section && !reduce) {
                    const after: Element[] = []
                    for (let el = section.nextElementSibling; el; el = el.nextElementSibling) after.push(el)
                    flipRef.current = new Map(after.map((el) => [el, el.getBoundingClientRect().top]))
                }
                setClosed(true)
            },
            reduce ? 0 : DONE_MS + CLOSE_MS,
        )
        return () => {
            clearTimeout(t1)
            clearTimeout(t2)
        }
    }, [empty, answered, closed, reduce])

    useLayoutEffect(() => {
        const before = flipRef.current
        if (!closed || !before) return
        flipRef.current = null
        before.forEach((top, el) => {
            const dy = top - el.getBoundingClientRect().top
            if (dy) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
        })
    }, [closed])

    const endFlight = useCallback((f: Flight) => {
        setFlights((list) => list.filter((x) => x.id !== f.id))
        f.land()
    }, [])

    /** La ficha vuela del botón «sí» al atajo de la lista; al llegar, los contadores cambian (sin atajo visible, al momento). */
    function launchFlight(game: LibraryGame, kind: Suggestion) {
        const land = () => announceListMove(game.status, kind)
        const button = document.querySelector(`[data-sg-yes="${game.appid}"]`)
        const target = listShortcut(kind)
        if (reduce || !button || !target) {
            land()
            return
        }
        const a = button.getBoundingClientRect()
        const b = target.getBoundingClientRect()
        setFlights((f) => [
            ...f,
            { id: ++seq.current, kind, from: { x: a.left, y: a.top + a.height / 2 - 13 }, to: { x: b.left + b.width / 2, y: b.top + b.height / 2 }, land },
        ])
    }

    function forget(appid: number) {
        setList((l) => l.filter((g) => g.appid !== appid))
        setLeaving((m) => {
            const next = new Map(m)
            next.delete(appid)
            return next
        })
    }

    /** Respuesta «sí»: la fila se tiñe de su lista, sale hacia la derecha y la ficha vuela a su atajo. */
    function leave(game: LibraryGame, kind: Suggestion, then?: () => void) {
        setAnswered(true)
        if (reduce) {
            forget(game.appid)
            announceListMove(game.status, kind)
            then?.()
            return
        }
        setLeaving((m) => new Map(m).set(game.appid, 'going'))
        setTimeout(() => {
            launchFlight(game, kind)
            forget(game.appid)
            then?.()
        }, TINT_MS)
    }

    async function pause(game: LibraryGame) {
        if (pending) return
        setPending(`${game.appid}:pausar`)
        setError('')
        const snapshot = statusSnapshot(game)
        try {
            await setGamesStatus([game.appid], 'pausado')
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo guardar')
            return
        } finally {
            setPending(null)
        }
        leave(game, 'pausado', () => setToast({ id: ++seq.current, type: 'pausado', game, snapshot }))
    }

    /** «Todavía no» / «Sigo con él»: la fila se apaga sin color ni ficha y el aviso dice cuándo volverá a preguntar. */
    async function dismiss(game: LibraryGame) {
        if (pending) return
        setPending(`${game.appid}:descartar`)
        setError('')
        try {
            await dismissSuggestion(game.appid)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo guardar')
            return
        } finally {
            setPending(null)
        }
        setAnswered(true)
        const show = () => setToast({ id: ++seq.current, type: 'descartado', game, evidence: evidence.get(game.appid) ?? null })
        if (reduce) {
            forget(game.appid)
            show()
            return
        }
        // Primero se pinta la salida en neutro; en el siguiente pase se quita (AnimatePresence usa la última salida pintada).
        setLeaving((m) => new Map(m).set(game.appid, 'dismiss'))
        setTimeout(() => {
            forget(game.appid)
            show()
        }, 20)
    }

    /** Deshacer: la fila vuelve a su sitio con un resalte y los contadores bajan; en la base, el estado o la sugerencia de antes. */
    async function undo() {
        const t = toast
        if (!t) return
        setToast(null)
        const { game } = t
        setList((l) => [...l.filter((g) => g.appid !== game.appid), game])
        setClosing(false)
        setClosed(false)
        if (!reduce) {
            setBack(new Set([game.appid]))
            setTimeout(() => setBack(new Set()), 1200)
        }
        if (t.type === 'pausado') announceListMove(game.status, 'pausado', -1)
        try {
            if (t.type === 'pausado') await restoreGames([t.snapshot])
            else await restoreSuggestion(game.appid, game.suggestion ?? 'completado', game.suggestion_dismissed_at)
        } catch (e) {
            setError(`No se pudo deshacer: ${e instanceof Error ? e.message : 'error al guardar'}`)
        }
    }

    // Posición de cada fila en la entrada escalonada (la cabecera es la 0).
    const order = new Map(shown.flatMap((g) => g.games).map((g, i) => [g.appid, i + 1]))
    const panel =
        closed || (empty && !answered) ? null : (
            <section
                ref={sectionRef}
                className={`sg hg-enter${closing ? ' is-closing' : ''}`}
                style={{ '--i': 2 } as CSSVars}
                aria-labelledby={titleId}
            >
                <div className="sg-head">
                    <span className="sg-head__icon" aria-hidden>
                        <CircleHelp />
                    </span>
                    <h2 id={titleId}>{one ? SUGGESTION_COPY[parseSuggestion(list[0].suggestion) ?? 'completado'].question : '¿Cómo van tus juegos?'}</h2>
                    {!empty && (
                        <span className="sg-head__count">
                            {one ? (
                                'De la última sincronización'
                            ) : (
                                <>
                                    <AnimatedCount value={list.length} /> sugerencias de la última sincronización
                                </>
                            )}
                        </span>
                    )}
                    {!one && !empty && (
                        <span className="sg-head__end">
                            {groups.map((g) => {
                                const Icon = LIST_ICONS[g.kind]
                                return (
                                    <span key={g.kind} className={`sg-sum hg-tint st-${g.kind}`}>
                                        <Icon aria-hidden />
                                        <AnimatedCount value={g.games.length} /> {SUGGESTION_COPY[g.kind].summary}
                                    </span>
                                )
                            })}
                        </span>
                    )}
                </div>

                {error && (
                    <p className="alert alert--error" role="alert">
                        {error}
                    </p>
                )}

                {empty ? (
                    <p className="sg-done" role="status">
                        <span className="sg-done__icon hg-tint st-completado" aria-hidden>
                            <Check className="hg-draw" />
                        </span>
                        <span>
                            <b>Todo al día.</b> Te avisaremos tras la próxima sincronización.
                        </span>
                    </p>
                ) : (
                    <AnimatePresence initial={false}>
                        {shown.map((group) => {
                            const copy = SUGGESTION_COPY[group.kind]
                            const Icon = LIST_ICONS[group.kind]
                            const total = groups.find((g) => g.kind === group.kind)?.games.length ?? 0
                            return (
                                <motion.div
                                    key={group.kind}
                                    className="sg-group"
                                    layout={reduce ? false : 'position'}
                                    transition={{ layout: { duration: 0.24, ease: EASE_OUT } }}
                                    exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.2 } }}
                                >
                                    {!one && (
                                        <p className="sg-group__head">
                                            <span className={`sg-group__icon hg-tint st-${group.kind}`} aria-hidden>
                                                <Icon />
                                            </span>
                                            {copy.question} <AnimatedCount value={total} className="sg-group__n" />
                                            <span className="sg-group__rule">{copy.rule}</span>
                                        </p>
                                    )}
                                    <ul className="sg-list" aria-label={copy.question}>
                                        <AnimatePresence initial={false}>
                                            {group.games.map((game) => {
                                                const i = order.get(game.appid) ?? 0
                                                const ev = evidence.get(game.appid) ?? null
                                                const name = game.name ?? `App ${game.appid}`
                                                const out = leaving.get(game.appid)
                                                const busy = pending?.startsWith(`${game.appid}:`) || !!out
                                                const YesIcon = LIST_ICONS[group.kind]
                                                const classes = [
                                                    'sg-row',
                                                    `st-${group.kind}`,
                                                    out === 'going' && 'is-going',
                                                    out === 'dismiss' && 'is-dismissing',
                                                    back.has(game.appid) ? 'is-back' : !entered && 'hg-enter is-entering',
                                                ]
                                                return (
                                                    <motion.li
                                                        key={game.appid}
                                                        layout={reduce ? false : 'position'}
                                                        transition={{ layout: { duration: 0.24, ease: EASE_OUT } }}
                                                        initial={entered && !back.has(game.appid) && !reduce ? { opacity: 0, y: 8 } : false}
                                                        animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT } }}
                                                        exit={
                                                            reduce
                                                                ? undefined
                                                                : out === 'dismiss'
                                                                  ? { opacity: 0, scale: 0.97, transition: { duration: 0.2, ease: 'easeIn' } }
                                                                  : { opacity: 0, x: 48, transition: { duration: 0.24, ease: [0.4, 0, 1, 1] } }
                                                        }
                                                        className={classes.filter(Boolean).join(' ')}
                                                        style={{ '--i': i } as CSSVars}
                                                    >
                                                        <span className="hg-row__cover sg-cover">
                                                            <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="header" sizes="112px" />
                                                        </span>
                                                        <span className="sg-main">
                                                            <span className="sg-name">
                                                                <Link href={`/juego/${game.appid}`} className="sg-link">
                                                                    {name}
                                                                </Link>
                                                                <MarkFlags favorite={game.favorite} endless={game.endless} />
                                                            </span>
                                                            {ev && ev.why !== 'otro' && (
                                                                <span className="sg-ev">
                                                                    <Evidence ev={ev} />
                                                                </span>
                                                            )}
                                                            <Context game={game} ev={ev} now={now} />
                                                        </span>
                                                        <span className="sg-acts" role="group" aria-label={`${copy.question} ${name}`}>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                className={`sg-yes hg-tint st-${group.kind}`}
                                                                data-sg-yes={game.appid}
                                                                loading={pending === `${game.appid}:pausar`}
                                                                disabled={busy}
                                                                onClick={() => (group.kind === 'completado' ? setCompleting(game) : void pause(game))}
                                                            >
                                                                <YesIcon aria-hidden />
                                                                {copy.yes}
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="secondary"
                                                                loading={pending === `${game.appid}:descartar`}
                                                                disabled={busy}
                                                                onClick={() => void dismiss(game)}
                                                            >
                                                                {copy.no}
                                                            </Button>
                                                        </span>
                                                    </motion.li>
                                                )
                                            })}
                                        </AnimatePresence>
                                    </ul>
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                )}

                {!empty && hidden > 0 && (
                    <Button type="button" size="sm" variant="ghost" className="sg-more" onClick={() => setExpanded(true)}>
                        Ver {hidden} más <ChevronDown aria-hidden />
                    </Button>
                )}
            </section>
        )

    return (
        <>
            {panel}

            <div className="sg-float">
                <AnimatePresence>
                    {toast && (
                        <motion.div
                            key={toast.id}
                            className="sg-toast"
                            role="status"
                            initial={reduce ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } }}
                            exit={reduce ? undefined : { opacity: 0, y: 8, transition: { duration: 0.16, ease: 'easeIn' } }}
                        >
                            {toast.type === 'pausado' ? (
                                <span className="sg-toast__txt">
                                    <b>{toast.game.name ?? `App ${toast.game.appid}`}</b>
                                    <ArrowRight aria-hidden />
                                    <StatusChip status="pausado" />
                                </span>
                            ) : (
                                <span className="sg-toast__txt">
                                    <span className="sg-toast__line">
                                        Vale, sigue en <StatusChip status={toast.game.status} />
                                    </span>
                                    <small>{dismissReason(toast.evidence)}</small>
                                </span>
                            )}
                            <Button type="button" size="sm" variant="ghost" className="sg-toast__undo" onClick={() => void undo()}>
                                <Undo2 aria-hidden /> Deshacer
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {flights.map((f) => (
                <FlyingChip key={f.id} flight={f} onDone={endFlight} />
            ))}

            <CompleteDialog
                games={completing ? [completing] : null}
                onClose={() => {
                    // Sale de la lista al cerrar, tras la celebración, y vuela a Completados.
                    const done = completedRef.current
                    completedRef.current = null
                    setCompleting(null)
                    if (done) leave(done, 'completado')
                }}
                onSaved={() => {
                    completedRef.current = completing
                }}
            />
        </>
    )
}

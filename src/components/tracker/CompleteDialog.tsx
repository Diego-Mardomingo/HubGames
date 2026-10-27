'use client'

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Calendar, Check, Clock, Flag, Gamepad2, Heart, Infinity as InfinityIcon, Pencil, SkipForward, Star, Trophy } from 'lucide-react'
import { DialogContent, Dialog, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import GameCover from './GameCover'
import { formatHours } from '@/lib/format'
import { ratingLabel, ratingTier } from '@/lib/scores'
import {
    batchFinished,
    batchLeft,
    batchStep,
    batchSummary,
    completeRest,
    dotFill,
    newlyLitDots,
    ratingAtFraction,
    ratingForKey,
    ratingTap,
    startBatch,
    type BatchState,
} from '@/lib/completion'
import { saveCompletion, suggestedCompletionDate, type Completion, type LibraryGame } from '@/lib/tracker'
import './tracker.css'

export type CompletableGame = Pick<
    LibraryGame,
    | 'appid'
    | 'name'
    | 'status'
    | 'rating'
    | 'completed_at'
    | 'review'
    | 'last_unlock_at'
    | 'rtime_last_played'
    | 'header_image'
    | 'playtime_forever'
    | 'hltb_main'
    | 'achievements_unlocked'
    | 'achievements_total'
    | 'favorite'
    | 'endless'
>

export interface SavedCompletion {
    appid: number
    completion: Completion
}

interface Props {
    /** Uno (ficha, sugerencias) o varios en lote (bandeja), uno tras otro. null o vacío = cerrado. */
    games: CompletableGame[] | null
    /** Ya guardados (uno, o varios con «Completar los restantes»). Llega antes de la celebración. */
    onSaved: (saved: SavedCompletion[]) => void
    /** Cancelar, cortar el lote o fin de la celebración. */
    onClose: () => void
    /** Para quien quiera llevar el foco a otro sitio al cerrar (`preventDefault`). */
    onCloseAutoFocus?: (event: Event) => void
}

/** yyyy-mm-dd en la zona horaria del navegador. */
function toDateInput(iso: string): string {
    return new Date(iso).toLocaleDateString('sv-SE')
}

const LONG_DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const SHORT_DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })
const shortDate = (iso: string) => SHORT_DATE.format(new Date(iso)).replace('.', '')
const longDate = (iso: string) => LONG_DATE.format(new Date(iso)).replace('.', '')
const fmtRating = (r: number) => r.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const tierClass = (r: number | null) => `sc-${r === null ? 'none' : ratingTier(r)}`

/** Mediodía local: la fecha no cambia de día al pasarla a UTC. */
const dateToIso = (date: string) => new Date(`${date}T12:00:00`).toISOString()

/** Lo que se guarda sin abrir el formulario («Completar los restantes sin nota»): lo que ya tenía y la fecha sugerida. */
function defaultCompletion(game: CompletableGame): Completion {
    return {
        rating: game.rating,
        completedAt: game.completed_at ?? suggestedCompletionDate(game)?.date ?? new Date().toISOString(),
        review: game.review,
        favorite: game.favorite,
        endless: game.endless,
    }
}

/**
 * Diálogo de completar (#19): nota de 0 a 10 en medios puntos, marcas, fecha sugerida y reseña opcional, con celebración
 * al terminar. Si el juego ya estaba completado, edita sus datos («Guardar cambios», sin celebración). Con varios juegos
 * (lote desde la bandeja) los recorre uno a uno: completar y seguir, saltar o cancelar el resto.
 * En móvil (≤ 640 px) es una hoja inferior con el pie fijo (tracker.css).
 */
export default function CompleteDialog({ games, onSaved, onClose, onCloseAutoFocus }: Props) {
    const open = !!games && games.length > 0
    const key = open ? games.map((g) => g.appid).join(',') : ''
    // Los juegos se fijan al abrir: guardar cambia el juego en quien abre el diálogo (estado, nota) y el diálogo no
    // debe reiniciarse ni pasar a «Editar» a mitad de la celebración. Se conservan al cerrar para la animación de salida.
    const [held, setHeld] = useState<{ key: string; games: CompletableGame[]; gen: number; open: boolean } | null>(null)
    if (open && (!held || !held.open || held.key !== key)) {
        setHeld({ key, games, gen: (held?.gen ?? 0) + 1, open: true })
    } else if (!open && held?.open) {
        setHeld({ ...held, open: false })
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            {held && (
                <CompleteFlow
                    key={held.gen}
                    games={held.games}
                    onSaved={onSaved}
                    onClose={onClose}
                    onCloseAutoFocus={onCloseAutoFocus}
                />
            )}
        </Dialog>
    )
}

interface Celebration {
    /** quick: entre juegos de un lote (sin chispas); full: al final. */
    kind: 'quick' | 'full'
    title: string
    sub: string
    next: string | null
    rating: number | null
    hours: number
    favorite: boolean
    /** Qué pasa al terminar: seguir con el lote o cerrar. */
    then: BatchState | null
}

const QUICK_MS = 680
const FULL_MS = 1250

function CompleteFlow({
    games,
    onSaved,
    onClose,
    onCloseAutoFocus,
}: {
    games: CompletableGame[]
    onSaved: Props['onSaved']
    onClose: Props['onClose']
    onCloseAutoFocus: Props['onCloseAutoFocus']
}) {
    const reduce = useReducedMotion() ?? false
    const isBatch = games.length > 1
    const [batch, setBatch] = useState<BatchState>(() => startBatch(games.length))
    const [cel, setCel] = useState<Celebration | null>(null)
    const [restSaving, setRestSaving] = useState(false)
    const [restError, setRestError] = useState('')
    const finishing = useRef(false)
    const index = Math.min(batch.index, games.length - 1)
    const game = games[index]
    const left = batchLeft(batch)

    /** Fin de la celebración (o un clic o una tecla que la corta): sigue con el lote o cierra. */
    function finish() {
        if (!cel || finishing.current) return
        finishing.current = true
        const then = cel.then
        setCel(null)
        if (then) setBatch(then)
        else onClose()
    }

    useEffect(() => {
        if (!cel) return
        finishing.current = false
        const t = setTimeout(finish, cel.kind === 'quick' ? QUICK_MS : FULL_MS)
        return () => clearTimeout(t)
        // finish lee `cel`, que es la dependencia.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cel])

    /** Final del lote o de un juego suelto: celebración completa y cerrar (al momento con movimiento reducido). */
    function celebrateEnd(state: BatchState, last: CompletableGame, completion: Completion | null) {
        if (reduce) {
            onClose()
            return
        }
        const { done, skipped } = batchSummary(state)
        setCel({
            kind: 'full',
            title: isBatch ? `${done} ${done === 1 ? 'completado' : 'completados'}` : '¡Completado!',
            sub: isBatch
                ? `${skipped ? `${skipped} ${skipped === 1 ? 'saltado sigue' : 'saltados siguen'} en la bandeja. ` : ''}${done === 1 ? 'Ya está' : 'Ya están'} en tu lista de Completados.`
                : (last.name ?? `App ${last.appid}`),
            next: null,
            rating: isBatch ? null : (completion?.rating ?? null),
            hours: isBatch ? 0 : last.playtime_forever,
            favorite: !isBatch && !!completion?.favorite,
            then: null,
        })
    }

    /** El formulario ya ha guardado el juego actual. */
    function saved(completion: Completion, editing: boolean) {
        onSaved([{ appid: game.appid, completion }])
        if (editing) {
            onClose()
            return
        }
        if (!isBatch) {
            celebrateEnd(batchStep(batch, 'done'), game, completion)
            return
        }
        const next = batchStep(batch, 'done')
        if (batchFinished(next)) {
            setBatch(next)
            celebrateEnd(next, game, completion)
        } else if (reduce) {
            setBatch(next)
        } else {
            setCel({
                kind: 'quick',
                title: '¡Completado!',
                sub: game.name ?? `App ${game.appid}`,
                next: games[next.index].name ?? `App ${games[next.index].appid}`,
                rating: completion.rating,
                hours: game.playtime_forever,
                favorite: completion.favorite,
                then: next,
            })
        }
    }

    /** «Saltar este»: se queda en la bandeja (y seleccionado). */
    function skip() {
        const next = batchStep(batch, 'skip')
        setBatch(next)
        if (!batchFinished(next)) return
        if (batchSummary(next).done > 0) celebrateEnd(next, game, null)
        else onClose()
    }

    /** «Completar los N restantes sin nota»: el actual y los que faltan, con lo que ya tenían y su fecha sugerida. */
    async function completeTheRest() {
        const rest = games.slice(index)
        const list = rest.map((g) => ({ appid: g.appid, completion: defaultCompletion(g) }))
        setRestSaving(true)
        setRestError('')
        const results = await Promise.allSettled(list.map((s) => saveCompletion(s.appid, s.completion)))
        setRestSaving(false)
        const ok = list.filter((_, i) => results[i].status === 'fulfilled')
        if (ok.length) onSaved(ok)
        const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
        if (failed) {
            // Lo guardado ya se ha ido de la bandeja; el lote sigue con el primero que falló.
            setRestError(failed.reason instanceof Error ? failed.reason.message : 'No se pudo guardar')
            let state = batch
            for (const s of list) {
                if (!ok.includes(s)) break
                state = batchStep(state, 'done')
            }
            setBatch(state)
            return
        }
        const next = completeRest(batch)
        setBatch(next)
        celebrateEnd(next, game, null)
    }

    return (
        <DialogContent
            className={`complete-dialog${isBatch ? ' is-batch' : ''}`}
            aria-describedby={undefined}
            onCloseAutoFocus={onCloseAutoFocus}
            onEscapeKeyDown={(e) => {
                if (cel) {
                    e.preventDefault()
                    finish()
                }
            }}
            onPointerDownOutside={(e) => {
                if (cel) {
                    e.preventDefault()
                    finish()
                }
            }}
            onKeyDownCapture={(e) => {
                if (!cel) return
                e.preventDefault()
                e.stopPropagation()
                finish()
            }}
            onPointerDownCapture={() => cel && finish()}
        >
            <span className="complete-handle" aria-hidden />
            {isBatch && (
                <div className="complete-batch">
                    <div className="complete-batch__row">
                        <Flag aria-hidden className="complete-batch__flag" />
                        <span>
                            Completando{' '}
                            <b>
                                {index + 1} de {games.length}
                            </b>
                            <span className="complete-batch__from"> de la bandeja</span>
                        </span>
                        <Button type="button" size="sm" variant="ghost" className="complete-batch__stop" onClick={onClose}>
                            Cancelar el resto
                        </Button>
                    </div>
                    <div className="complete-batch__row">
                        <ol className="complete-pips" aria-hidden>
                            {batch.marks.map((m, j) => (
                                <li
                                    key={j}
                                    className={`complete-pip${j === index && !batchFinished(batch) ? ' is-now' : m === 'done' ? ' is-done' : m === 'skip' ? ' is-skip' : ''}${m === 'done' && j === index - 1 ? ' is-new' : ''}`}
                                />
                            ))}
                        </ol>
                        {left > 1 ? (
                            <button type="button" className="complete-link complete-batch__next" disabled={restSaving} onClick={() => void completeTheRest()}>
                                {restSaving ? 'Completando…' : `Completar los ${left + 1} restantes sin nota`}
                            </button>
                        ) : (
                            <span className="complete-batch__next">
                                {left === 1 ? (
                                    <>
                                        Queda <b>{games[index + 1].name ?? `App ${games[index + 1].appid}`}</b>
                                    </>
                                ) : (
                                    'Es el último'
                                )}
                            </span>
                        )}
                    </div>
                </div>
            )}
            <CompleteForm
                key={game.appid}
                game={game}
                isBatch={isBatch}
                isLast={left === 0}
                isNext={isBatch && index > 0}
                reduce={reduce}
                extraError={restError}
                busy={restSaving || cel !== null}
                onSaved={saved}
                onCancel={onClose}
                onSkip={skip}
            />
            {cel && <CelebrationView cel={cel} />}
        </DialogContent>
    )
}

/** Anillo que se cierra, bandera que cae y se planta, chispas con los colores de lo que has puesto. */
function CelebrationView({ cel }: { cel: Celebration }) {
    const sparks = ['st-completado', cel.rating !== null ? `sc-${ratingTier(cel.rating)}` : 'st-completado', cel.favorite ? 'st-favorito' : 'st-completado']
    return (
        <div className={`complete-cel${cel.kind === 'quick' ? ' is-quick' : ''}`} role="status" aria-live="polite">
            <div className="complete-cel__mark" aria-hidden>
                <svg className="complete-cel__ring" viewBox="0 0 96 96">
                    <circle className="tr" cx="48" cy="48" r="42" />
                    <circle className="pr" cx="48" cy="48" r="42" />
                </svg>
                <span className="complete-cel__flag">
                    <Flag />
                </span>
                {cel.kind === 'full' && (
                    <span className="complete-cel__burst">
                        {Array.from({ length: 12 }, (_, k) => (
                            <i key={k} className={sparks[k % 3]} style={{ '--a': `${k * 30 + 8}deg` } as CSSProperties} />
                        ))}
                    </span>
                )}
            </div>
            <p className="complete-cel__title">{cel.title}</p>
            <p className="complete-cel__sub">{cel.sub}</p>
            {cel.next && (
                <p className="complete-cel__next">
                    Siguiente: <b>{cel.next}</b>
                </p>
            )}
            {cel.kind === 'full' && (cel.rating !== null || cel.hours > 0 || cel.favorite) && (
                <div className="complete-cel__chips">
                    {cel.rating !== null && (
                        <span className={`hg-score hg-tint sc-${ratingTier(cel.rating)}`}>
                            <Star aria-hidden />
                            {fmtRating(cel.rating)}
                            <span className="sr-only">, {ratingLabel(cel.rating)}</span>
                        </span>
                    )}
                    {cel.hours > 0 && (
                        <span className="hg-chip hg-tint st-completado">
                            <Clock aria-hidden />
                            {formatHours(cel.hours)}
                        </span>
                    )}
                    {cel.favorite && (
                        <span className="hg-chip hg-tint st-favorito">
                            <Heart aria-hidden />
                            Favorito
                        </span>
                    )}
                </div>
            )}
        </div>
    )
}

/** Horas frente a la historia y logros, con lo que haya. */
function GameContextLine({ game }: { game: CompletableGame }) {
    const played = game.playtime_forever
    const story = game.hltb_main && game.hltb_main > 0 ? game.hltb_main : null
    const total = game.achievements_total ?? 0
    const unlocked = game.achievements_unlocked ?? 0
    const C = 2 * Math.PI * 5.5
    const f = total > 0 ? Math.min(unlocked / total, 1) : 0
    return (
        <div className="complete-ctx">
            {played > 0 ? (
                <span title="Horas jugadas">
                    <Clock aria-hidden />
                    <b>{formatHours(played)}</b>
                    {story !== null && (
                        <>
                            <span className={`complete-mini${played >= story ? ' is-over' : ''}`} aria-hidden>
                                <span style={{ transform: `scaleX(${Math.min(played / story, 1).toFixed(2)})` }} />
                            </span>
                            de {formatHours(story)} de historia
                        </>
                    )}
                </span>
            ) : (
                <span>
                    <Clock aria-hidden />
                    Sin horas registradas
                </span>
            )}
            {total > 0 && (
                <span title="Logros conseguidos">
                    <svg className={`complete-ring${f === 1 ? ' is-full' : ''}`} viewBox="0 0 15 15" aria-hidden>
                        <circle className="tr" cx="7.5" cy="7.5" r="5.5" />
                        <circle className="pr" cx="7.5" cy="7.5" r="5.5" strokeDasharray={`${(f * C).toFixed(2)} ${C.toFixed(2)}`} />
                    </svg>
                    <b>{unlocked}</b> de {total} logros{f === 1 ? ' · 100 %' : ''}
                </span>
            )}
        </div>
    )
}

function CompleteForm({
    game,
    isBatch,
    isLast,
    isNext,
    reduce,
    extraError,
    busy,
    onSaved,
    onCancel,
    onSkip,
}: {
    game: CompletableGame
    isBatch: boolean
    isLast: boolean
    isNext: boolean
    reduce: boolean
    extraError: string
    busy: boolean
    onSaved: (completion: Completion, editing: boolean) => void
    onCancel: () => void
    onSkip: () => void
}) {
    const editing = game.status === 'completado'
    const suggestion = suggestedCompletionDate(game)
    const today = toDateInput(new Date().toISOString())
    const formRef = useRef<HTMLFormElement>(null)
    const [rating, setRating] = useState<number | null>(game.rating)
    const [date, setDate] = useState(toDateInput(game.completed_at ?? suggestion?.date ?? new Date().toISOString()))
    const [review, setReview] = useState(game.review ?? '')
    const [reviewOpen, setReviewOpen] = useState(!!game.review)
    const [favorite, setFavorite] = useState(game.favorite)
    const [endless, setEndless] = useState(game.endless)
    const [beat, setBeat] = useState<{ mark: 'favorite' | 'endless'; n: number } | null>(null)
    const [saving, setSaving] = useState(false)
    const [done, setDone] = useState(false)
    const [error, setError] = useState('')
    const ratingLabelId = `complete-rating-${game.appid}`

    function toggleMark(mark: 'favorite' | 'endless') {
        const on = mark === 'favorite' ? !favorite : !endless
        if (mark === 'favorite') setFavorite(on)
        else setEndless(on)
        setBeat(on ? { mark, n: (beat?.n ?? 0) + 1 } : null)
    }

    async function submit(e: FormEvent) {
        e.preventDefault()
        if (saving || done || busy) return
        setSaving(true)
        setError('')
        const completion: Completion = { rating, completedAt: dateToIso(date), review: review.trim() || null, favorite, endless }
        try {
            await saveCompletion(game.appid, completion)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo guardar')
            setSaving(false)
            return
        }
        setSaving(false)
        if (editing && !reduce) {
            // Editar: el botón dibuja un check y se cierra, sin celebración.
            setDone(true)
            setTimeout(() => onSaved(completion, true), 650)
        } else onSaved(completion, editing)
    }

    const suggestionDate = suggestion ? toDateInput(suggestion.date) : null
    const shownError = error || extraError

    return (
        <form ref={formRef} onSubmit={submit} className="complete-form">
            <div className="complete-scroll">
                <div className={`complete-body${isNext ? ' is-next' : ''}`}>
                    <header className="complete-head">
                        <span className="complete-cover hg-row__cover">
                            <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="header" sizes="136px" />
                        </span>
                        <div className="complete-head__text">
                            <span className="hg-chip hg-tint st-completado complete-kicker">
                                <Flag aria-hidden />
                                {editing && game.completed_at ? `Completado el ${longDate(game.completed_at)}` : 'Completado'}
                            </span>
                            <DialogTitle className="complete-title">
                                <span className="sr-only">{editing ? 'Editar: ' : 'Completar: '}</span>
                                {game.name ?? `App ${game.appid}`}
                            </DialogTitle>
                            <GameContextLine game={game} />
                        </div>
                    </header>

                    <div className="complete-field">
                        <div className="complete-label">
                            <span id={ratingLabelId}>Tu nota</span>
                            {rating !== null && (
                                <button type="button" className="complete-link" onClick={() => setRating(null)}>
                                    Sin nota
                                </button>
                            )}
                        </div>
                        <RatingDots
                            value={rating}
                            labelledBy={ratingLabelId}
                            onChange={setRating}
                            onSubmit={() => formRef.current?.requestSubmit()}
                        />
                        <p className="complete-hint complete-hint--keys">
                            <span>
                                <kbd>←</kbd>
                                <kbd>→</kbd> ±0,5
                            </span>
                            <span>
                                <kbd>0</kbd>–<kbd>9</kbd> esa nota
                            </span>
                            <span>
                                <kbd>Supr</kbd> sin nota
                            </span>
                            <span>
                                <kbd>Intro</kbd> {editing ? 'guardar' : 'completar'}
                            </span>
                        </p>
                    </div>

                    <div className="complete-marks" role="group" aria-label="Marcas">
                        {(
                            [
                                { mark: 'favorite', list: 'st-favorito', label: 'Favorito', Icon: Heart, on: favorite },
                                { mark: 'endless', list: 'st-sin_final', label: 'Sin final', Icon: InfinityIcon, on: endless },
                            ] as const
                        ).map(({ mark, list, label, Icon, on }) => (
                            <button
                                key={mark}
                                type="button"
                                className={`complete-mark ${list}`}
                                aria-pressed={on}
                                onClick={() => toggleMark(mark)}
                            >
                                <Icon aria-hidden key={beat?.mark === mark ? beat.n : 0} className={beat?.mark === mark ? 'hg-beat' : undefined} />
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="complete-field">
                        <div className="complete-label">
                            <label htmlFor={`complete-date-${game.appid}`}>Fecha</label>
                        </div>
                        <div className="complete-date">
                            <input
                                id={`complete-date-${game.appid}`}
                                type="date"
                                className="hg-input"
                                required
                                value={date}
                                max={today}
                                onChange={(e) => setDate(e.target.value)}
                            />
                            {suggestion && suggestionDate && (
                                <button
                                    type="button"
                                    className="complete-sug"
                                    aria-pressed={date === suggestionDate}
                                    title={longDate(suggestion.date)}
                                    onClick={() => setDate(suggestionDate)}
                                >
                                    {suggestion.source === 'logro' ? <Trophy aria-hidden /> : <Gamepad2 aria-hidden />}
                                    {suggestion.source === 'logro' ? 'Último logro' : 'Última partida'} · <b>{shortDate(suggestion.date)}</b>
                                </button>
                            )}
                            <button type="button" className="complete-sug" aria-pressed={date === today} onClick={() => setDate(today)}>
                                <Calendar aria-hidden />
                                <b>Hoy</b>
                            </button>
                        </div>
                    </div>

                    <div className="complete-field">
                        {reviewOpen ? (
                            <>
                                <div className="complete-label">
                                    <label htmlFor={`complete-review-${game.appid}`}>Reseña</label>
                                </div>
                                <textarea
                                    id={`complete-review-${game.appid}`}
                                    className="hg-input complete-review"
                                    rows={3}
                                    value={review}
                                    placeholder="¿Qué te ha parecido?"
                                    autoFocus={!game.review}
                                    onChange={(e) => setReview(e.target.value)}
                                />
                            </>
                        ) : (
                            <Button type="button" size="sm" variant="ghost" className="complete-review-btn" onClick={() => setReviewOpen(true)}>
                                <Pencil aria-hidden /> Añadir reseña
                            </Button>
                        )}
                    </div>

                    {shownError && (
                        <p className="alert alert--error" role="alert">
                            {shownError}
                        </p>
                    )}
                </div>
            </div>

            <div className="complete-foot">
                {isBatch ? (
                    <Button type="button" variant="ghost" className="complete-skip" disabled={saving || busy} onClick={onSkip}>
                        <SkipForward aria-hidden /> Saltar este
                    </Button>
                ) : (
                    <>
                        <span className="complete-foot__hint">
                            <kbd>Esc</kbd> cancelar
                        </span>
                        <Button type="button" variant="secondary" disabled={saving || done} onClick={onCancel}>
                            Cancelar
                        </Button>
                    </>
                )}
                <Button type="submit" className="complete-done" loading={saving}>
                    {done ? (
                        <>
                            <Check aria-hidden className="hg-draw" /> Guardado
                        </>
                    ) : editing ? (
                        <>
                            {!saving && <Check aria-hidden />} Guardar cambios
                        </>
                    ) : (
                        <>
                            {!saving && <Flag aria-hidden className="complete-done__flag" />}
                            {isBatch && !isLast ? 'Completar y seguir' : 'Completar'}
                        </>
                    )}
                </Button>
            </div>
        </form>
    )
}

/**
 * Diez puntos con medios (role="slider"): con el ratón, la mitad izquierda de un punto es su ,5 y al pasar se ve la nota
 * que pondrías; en táctil se arrastra por la fila o se toca (otro toque en el mismo punto le quita medio). Teclas en
 * `ratingForKey`. La cifra, su palabra y los puntos toman el color de `ratingTier`.
 */
function RatingDots({
    value,
    labelledBy,
    onChange,
    onSubmit,
}: {
    value: number | null
    labelledBy: string
    onChange: (rating: number | null) => void
    onSubmit: () => void
}) {
    const ref = useRef<HTMLDivElement>(null)
    const drag = useRef<{ start: number | null; moved: boolean; touch: boolean } | null>(null)
    const [ghost, setGhost] = useState<number | null>(null)
    // Nota anterior: decide qué puntos se encienden en cadena y si la cifra entra desde abajo o desde arriba.
    const [change, setChange] = useState<{ from: number | null; to: number | null; n: number }>({ from: value, to: value, n: 0 })
    if (change.to !== value) setChange({ from: change.to, to: value, n: change.n + 1 })

    // Con el foco al abrir: se puede puntuar con el teclado sin tocar el ratón.
    useEffect(() => {
        ref.current?.focus({ preventScroll: true })
    }, [])

    const pops = change.n > 0 ? newlyLitDots(change.from, change.to) : new Map<number, number>()
    const dir = change.n > 0 && change.from !== null && change.to !== null ? (change.to > change.from ? 'up' : 'down') : ''

    function at(clientX: number): number {
        const r = ref.current!.getBoundingClientRect()
        return ratingAtFraction((clientX - r.left - 2) / (r.width - 4))
    }

    function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
        if (e.altKey || e.ctrlKey || e.metaKey) return
        const result = ratingForKey(value, e.key)
        if (!result) return
        e.preventDefault()
        if (result === 'submit') onSubmit()
        else onChange(result.rating)
    }

    function onPointerDown(e: PointerEvent<HTMLDivElement>) {
        if (e.button !== 0) return
        drag.current = { start: value, moved: false, touch: e.pointerType !== 'mouse' }
        e.currentTarget.setPointerCapture(e.pointerId)
        e.currentTarget.focus({ preventScroll: true })
    }

    function onPointerMove(e: PointerEvent<HTMLDivElement>) {
        const v = at(e.clientX)
        const d = drag.current
        if (d) {
            if (v !== value) d.moved = true
            if (d.moved && v !== value) onChange(v)
        } else if (e.pointerType === 'mouse') setGhost(v)
    }

    function onPointerUp(e: PointerEvent<HTMLDivElement>) {
        const d = drag.current
        if (!d) return
        drag.current = null
        if (!d.moved) {
            const v = at(e.clientX)
            onChange(d.touch ? ratingTap(d.start, v) : v)
        }
        setGhost(null)
    }

    const tier = tierClass(value)
    return (
        <div className={`complete-rate ${tier}`}>
            <div className="complete-val" aria-hidden>
                <span className="complete-val__n">
                    <span key={change.n} className={dir}>
                        {value === null ? '—' : fmtRating(value)}
                    </span>
                </span>
                <span className="complete-val__w">{value === null ? 'Sin nota' : ratingLabel(value)}</span>
            </div>
            <div
                ref={ref}
                role="slider"
                tabIndex={0}
                aria-labelledby={labelledBy}
                aria-valuemin={0}
                aria-valuemax={10}
                aria-valuenow={value ?? undefined}
                aria-valuetext={value === null ? 'Sin nota' : `${fmtRating(value)} de 10, ${ratingLabel(value)}`}
                className={`complete-dots${value === null ? ' is-empty' : ''}`}
                onKeyDown={onKeyDown}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => {
                    drag.current = null
                    setGhost(null)
                }}
                onPointerLeave={() => !drag.current && setGhost(null)}
            >
                {Array.from({ length: 10 }, (_, i) => {
                    const p = i + 1
                    const fill = dotFill(value, p)
                    const g = fill === 'off' ? dotFill(ghost, p) : 'off'
                    const delay = pops.get(p)
                    const cls = [
                        'complete-dot',
                        fill === 'full' && 'is-on',
                        (fill === 'half' || g === 'half') && 'is-half',
                        g !== 'off' && 'is-ghost',
                        delay !== undefined && 'is-pop',
                    ]
                        .filter(Boolean)
                        .join(' ')
                    return (
                        <span key={p} className={cls} data-n={p} style={delay !== undefined ? ({ '--d': `${delay}ms` } as CSSProperties) : undefined}>
                            <span className="complete-dot__f" />
                        </span>
                    )
                })}
            </div>
        </div>
    )
}

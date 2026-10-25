'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Flag, Heart, HeartOff, LogIn, Play, Trophy } from 'lucide-react'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import {
    GAME_STATUSES,
    STATUS_LABELS,
    formatHours,
    playingLoad,
    setGameGoal,
    setGamesStatus,
    type GameStatus,
    type LibraryGame,
} from '@/lib/tracker'
import { DURATION_SOURCE_LABEL, achievementPercent, type GameDuration } from '@/lib/library'
import { isPerfect } from '@/lib/tracker-rules'
import { GAME_GOALS, GOAL_LABELS, goalProgress, parseGoal, type GameGoal } from '@/lib/game-goal'
import { addToWishlist, removeFromWishlist, type WishlistGame } from '@/lib/wishlist'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import '@/styles/lists.css'
import CompleteDialog from '@/components/tracker/CompleteDialog'
import { PriceLows, PriceNow } from '@/components/wishlist/PriceInfo'

interface Props {
    appid: number
    name: string
    /** Duraciones de HowLongToBeat o, si no hay, la mediana de SteamSpy (#23). */
    duration: GameDuration
}

type State =
    | { kind: 'cargando' }
    | { kind: 'sin_sesion' }
    | { kind: 'no_lo_tienes'; wish: WishlistGame | null }
    | { kind: 'ok'; userId: string; game: LibraryGame }

/** "Te faltan unas 11 h para terminar la historia" según el objetivo (#24). */
const GOAL_TARGET_TEXT: Record<GameGoal, string> = {
    historia: 'para terminar la historia',
    extras: 'para la historia y los extras',
    completo: 'para el 100 %',
}

const GOAL_DURATION_TEXT: Record<GameGoal, string> = {
    historia: 'de la historia',
    extras: 'de la historia y los extras',
    completo: 'del 100 %',
}

const DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

function formatDate(iso: string | null): string | null {
    return iso ? DATE.format(new Date(iso)) : null
}

/** Fecha corta para las cifras grandes ("23 oct 2026"). */
const SHORT_DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

/** Fila de la wishlist con precio y mínimos (#35, #36), o null si no está en ella. */
async function loadWish(appid: number): Promise<WishlistGame | null> {
    const { data } = await supabase.from('hubgames_wishlist').select('*').eq('appid', appid).maybeSingle()
    return (data as WishlistGame | null) ?? null
}

/** "Historia 12 h · Historia + extras 20 h · 100% 45 h (HowLongToBeat)". */
function DurationNote({ duration }: { duration: GameDuration }) {
    if (!duration.source) return null
    const parts = [
        duration.main !== null && `Historia ${formatHours(duration.main)}`,
        duration.mainExtra !== null && `Historia + extras ${formatHours(duration.mainExtra)}`,
        duration.completionist !== null && `100% ${formatHours(duration.completionist)}`,
    ].filter(Boolean)
    return (
        <p className="juego-panel__note">
            Duración: {parts.join(' · ')} <span className="juego-panel__source">({DURATION_SOURCE_LABEL[duration.source]})</span>
        </p>
    )
}

/** Tus datos del juego y las acciones (#22). Se cargan en el cliente: la ficha de Steam ya viene del servidor. */
export default function GamePanel({ appid, name, duration }: Props) {
    const [state, setState] = useState<State>({ kind: 'cargando' })
    const [completing, setCompleting] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [warning, setWarning] = useState('')

    useEffect(() => {
        let cancelled = false
        safeGetSession().then(async ({ data: { session } }) => {
            if (!session) {
                if (!cancelled) setState({ kind: 'sin_sesion' })
                return
            }
            const { data, error: loadError } = await supabase.from('hubgames_library').select('*').eq('appid', appid).maybeSingle()
            const wish = data ? null : await loadWish(appid)
            if (cancelled) return
            if (loadError) setError(loadError.message)
            setState(data ? { kind: 'ok', userId: session.user.id, game: data as LibraryGame } : { kind: 'no_lo_tienes', wish })
        })
        return () => {
            cancelled = true
        }
    }, [appid])

    if (state.kind === 'cargando') {
        return (
            <section className="juego-panel glass" aria-busy>
                <Skeleton className="juego-skel juego-skel--bar" />
                <Skeleton className="juego-skel juego-skel--block" />
            </section>
        )
    }

    if (state.kind === 'sin_sesion') {
        return (
            <section className="juego-panel glass juego-panel--empty">
                <p>Inicia sesión para ver tus horas, tus logros y el estado del juego.</p>
                <Button variant="secondary" asChild>
                    <Link href="/login">
                        <LogIn aria-hidden /> Entrar
                    </Link>
                </Button>
            </section>
        )
    }

    if (state.kind === 'no_lo_tienes') {
        const { wish } = state
        const toggleWish = async () => {
            setBusy(true)
            setError('')
            try {
                if (wish) await removeFromWishlist(appid)
                else await addToWishlist(appid)
                setState({ kind: 'no_lo_tienes', wish: wish ? null : await loadWish(appid) })
            } catch (e) {
                setError(e instanceof Error ? e.message : 'No se pudo guardar')
            } finally {
                setBusy(false)
            }
        }
        return (
            <section className="juego-panel glass juego-panel--empty">
                <p>{wish ? 'Está en tu wishlist.' : 'No está en tu biblioteca de Steam.'}</p>
                {wish && (
                    <div className="juego-price">
                        <PriceNow game={wish} />
                        <PriceLows game={wish} />
                    </div>
                )}
                {error && (
                    <p className="alert alert--error" role="alert">
                        {error}
                    </p>
                )}
                <div className="juego-panel__actions">
                    {wish?.source === 'steam' ? (
                        <Button variant="secondary" asChild>
                            <Link href="/wishlist">
                                <Heart aria-hidden /> Ver la wishlist
                            </Link>
                        </Button>
                    ) : (
                        <Button variant="secondary" onClick={toggleWish} disabled={busy}>
                            {wish ? <HeartOff aria-hidden /> : <Heart aria-hidden />} {wish ? 'Quitar de la wishlist' : 'Añadir a la wishlist'}
                        </Button>
                    )}
                </div>
                <DurationNote duration={duration} />
            </section>
        )
    }

    const { game, userId } = state
    const pct = achievementPercent(game)

    function update(patch: Partial<LibraryGame>) {
        setState((s) => (s.kind === 'ok' ? { ...s, game: { ...s.game, ...patch } } : s))
    }

    async function changeGoal(goal: GameGoal) {
        if (goal === parseGoal(game.goal)) return
        setBusy(true)
        setError('')
        try {
            await setGameGoal(appid, goal)
            update({ goal })
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo guardar')
        } finally {
            setBusy(false)
        }
    }

    const progress = goalProgress(game)
    // Con objetivo 100 %, al llegar al 100 % de logros se propone marcarlo como completado.
    const suggestComplete = progress.goal === 'completo' && progress.done && game.status !== 'completado'

    async function changeStatus(status: GameStatus) {
        if (status === game.status) return
        if (status === 'completado') {
            setCompleting(true)
            return
        }
        setBusy(true)
        setError('')
        setWarning('')
        try {
            await setGamesStatus([appid], status)
            update({
                status,
                status_source: 'manual',
                suggestion: null,
                ...(status === 'jugando' && !game.started_at && { started_at: new Date().toISOString() }),
            })
            if (status === 'jugando') {
                const { count, limit } = await playingLoad(userId)
                if (count > limit) setWarning(`Ahora tienes ${count} juegos en Jugando y tu límite es ${limit}.`)
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo guardar')
        } finally {
            setBusy(false)
        }
    }

    return (
        <section className="juego-panel glass" aria-label="Tus datos">
            <div className="juego-panel__top">
                <div className="juego-panel__selects">
                    <label className="juego-panel__field">
                        <span>Estado</span>
                        <Select value={game.status} onValueChange={(v) => changeStatus(v as GameStatus)} disabled={busy}>
                            <SelectTrigger className={`juego-panel__select lib-status--${game.status}`} aria-label="Estado">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {GAME_STATUSES.map((s) => (
                                    <SelectItem key={s} value={s}>
                                        {STATUS_LABELS[s]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </label>
                    <label className="juego-panel__field">
                        <span>Objetivo</span>
                        <Select value={parseGoal(game.goal)} onValueChange={(v) => changeGoal(v as GameGoal)} disabled={busy}>
                            <SelectTrigger className="juego-panel__select juego-panel__select--goal" aria-label="Objetivo">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {GAME_GOALS.map((g) => (
                                    <SelectItem key={g} value={g}>
                                        {GOAL_LABELS[g]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </label>
                </div>
                <div className="juego-panel__actions">
                    <Button asChild>
                        <a href={`steam://run/${appid}`}>
                            <Play aria-hidden /> Jugar
                        </a>
                    </Button>
                    <Button variant="secondary" onClick={() => setCompleting(true)}>
                        <Flag aria-hidden /> {game.status === 'completado' ? 'Editar nota' : 'Completar'}
                    </Button>
                </div>
            </div>

            {error && (
                <p className="alert alert--error" role="alert">
                    {error}
                </p>
            )}
            {warning && (
                <p className="juego-panel__warning" role="status">
                    <AlertTriangle size={14} aria-hidden /> {warning}{' '}
                    <Link href="/biblioteca?estado=jugando">Ver los que juegas</Link>
                </p>
            )}

            <dl className="juego-stats">
                <div>
                    <dt>Horas</dt>
                    <dd>{formatHours(game.playtime_forever)}</dd>
                    {game.playtime_2weeks > 0 && <span>{formatHours(game.playtime_2weeks)} en 2 semanas</span>}
                </div>
                <div>
                    <dt>Última partida</dt>
                    <dd>{game.rtime_last_played ? SHORT_DATE.format(new Date(game.rtime_last_played)) : 'Nunca'}</dd>
                    {game.started_at && game.status === 'jugando' && <span>Jugando desde el {formatDate(game.started_at)}</span>}
                </div>
                <div>
                    <dt>Tu nota</dt>
                    <dd>{game.rating !== null ? String(game.rating).replace('.', ',') : '—'}</dd>
                    {game.completed_at && <span>Completado el {formatDate(game.completed_at)}</span>}
                </div>
                <div>
                    <dt>Logros</dt>
                    {pct === null ? (
                        <dd>Sin logros</dd>
                    ) : (
                        <>
                            <dd>
                                {game.achievements_unlocked ?? 0}
                                <small>/{game.achievements_total}</small>
                                {isPerfect(game) ? (
                                    <span className="badge-100" title="Todos los logros desbloqueados">
                                        <Trophy size={11} aria-hidden /> 100%
                                    </span>
                                ) : (
                                    <small className="juego-stats__pct">{pct} %</small>
                                )}
                            </dd>
                            <span className={`hg-bar${isPerfect(game) ? ' is-done' : ''}`} aria-hidden>
                                <span style={{ width: `${pct}%` }} />
                            </span>
                            <span>
                                {game.last_unlock_at && `Último el ${formatDate(game.last_unlock_at)} · `}
                                <Link href={`/juego/${appid}/logros`} className="juego-stats__link">
                                    Ver logros
                                </Link>
                            </span>
                        </>
                    )}
                </div>
            </dl>

            <div className="juego-goal">
                <div className="juego-goal__row">
                    <span className="juego-goal__label">Objetivo: {GOAL_LABELS[progress.goal]}</span>
                    <span className="juego-goal__value">
                        {progress.percent === null
                            ? 'Sin duración para medirlo'
                            : progress.basis === 'logros'
                              ? `${progress.percent} % de logros`
                              : `${progress.percent} % · ${formatHours(game.playtime_forever)} de ${formatHours(progress.targetMinutes!)}`}
                    </span>
                </div>
                {progress.percent !== null && (
                    <span className={`hg-bar${progress.done ? ' is-done' : ''}`} aria-hidden>
                        <span style={{ width: `${progress.percent}%` }} />
                    </span>
                )}
                {suggestComplete && (
                    <p className="juego-goal__done" role="status">
                        <Trophy size={14} aria-hidden /> ¡Objetivo cumplido: tienes todos los logros!{' '}
                        <Button size="sm" onClick={() => setCompleting(true)}>
                            <Flag aria-hidden /> Marcar como completado
                        </Button>
                    </p>
                )}
                {progress.basis === 'horas' && progress.targetMinutes !== null && duration.source && (
                    <p className="juego-panel__note">
                        {progress.targetMinutes - game.playtime_forever > 30
                            ? `Te faltan unas ${formatHours(progress.targetMinutes - game.playtime_forever)} ${GOAL_TARGET_TEXT[progress.goal]} (${formatHours(progress.targetMinutes)}).`
                            : `Ya has pasado la duración ${GOAL_DURATION_TEXT[progress.goal]} (${formatHours(progress.targetMinutes)}).`}{' '}
                        <span className="juego-panel__source">Según {DURATION_SOURCE_LABEL[duration.source]}.</span>
                    </p>
                )}
                {duration.source === 'hltb' && (duration.mainExtra !== null || duration.completionist !== null) && (
                    <DurationNote duration={duration} />
                )}
            </div>

            <CompleteDialog
                game={completing ? { ...game, name } : null}
                onOpenChange={(open) => !open && setCompleting(false)}
                onSaved={(_, completion) => {
                    setCompleting(false)
                    update({
                        status: 'completado',
                        status_source: 'manual',
                        suggestion: null,
                        rating: completion.rating,
                        completed_at: completion.completedAt,
                        review: completion.review,
                    })
                }}
            />
        </section>
    )
}

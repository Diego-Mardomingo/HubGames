'use client'

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import Tile from '@/components/Tile'
import {
    AlertTriangle,
    BookmarkPlus,
    BookmarkX,
    CalendarClock,
    Clock,
    Flag,
    Heart,
    HeartOff,
    Hourglass,
    Infinity as InfinityIcon,
    LineChart,
    LogIn,
    ShoppingCart,
    Star,
    Target,
    TrendingDown,
    Trophy,
} from 'lucide-react'
import {
    GAME_STATUSES,
    STATUS_LABELS,
    addToPending,
    formatHours,
    playingLoad,
    removeFromPending,
    setGameGoal,
    setGameMark,
    setGamesStatus,
    type GameMark,
    type GameStatus,
    type LibraryGame,
} from '@/lib/tracker'
import { DURATION_SOURCE_LABEL, achievementPercent, type GameDuration } from '@/lib/library'
import { isPerfect } from '@/lib/tracker-rules'
import { GAME_GOALS, GOAL_LABELS, goalProgress, parseGoal, type GameGoal } from '@/lib/game-goal'
import { addToWishlist, formatPrice, itadUrl, removeFromWishlist } from '@/lib/wishlist'
import { costPerHourTier, euroPerHour as euroPerHourOf, priceRule, priceVerdict, ratingTier } from '@/lib/scores'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GamePanelSkeleton } from './GameSkeleton'
import { Spinner } from '@/components/ui/spinner'
import { LIST_ICONS, StatusChip } from '@/components/tracker/status'
import type { PriceData } from '@/components/wishlist/PriceInfo'
import { useGame } from './GameContext'
import '@/styles/lists.css'

interface Props {
    /** Duraciones de HowLongToBeat o, si no hay, la mediana de SteamSpy (#23). */
    duration: GameDuration
    /** Logros del juego según la tienda, para los que no tienes. */
    achievementsTotal: number | null
    storeUrl: string
}

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
/** Fecha corta para las cifras grandes ("23 oct 2026"). */
const SHORT_DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

function formatDate(iso: string | null): string | null {
    return iso ? DATE.format(new Date(iso)) : null
}

type CSSVars = CSSProperties & Record<`--${string}`, string>

/** Tus datos del juego y las acciones (#22). Se cargan en el cliente: la ficha de Steam ya viene del servidor. */
export default function GamePanel(props: Props) {
    const { state } = useGame()

    if (state.kind === 'cargando') {
        return <GamePanelSkeleton />
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

    if (state.kind === 'no_lo_tienes') return <BuyPanel {...props} />
    return <OwnedPanel game={state.game} userId={state.userId} duration={props.duration} />
}

// ─── Lo tienes ───────────────────────────────────────────────────────────────

const MARKS: { mark: GameMark; list: 'favorito' | 'sin_final'; label: string }[] = [
    { mark: 'favorite', list: 'favorito', label: 'Favorito' },
    { mark: 'endless', list: 'sin_final', label: 'Sin final' },
]

function OwnedPanel({ game, userId, duration }: { game: LibraryGame; userId: string; duration: GameDuration }) {
    const { appid, update, openComplete } = useGame()
    /** Acción guardándose ("status:jugando", "mark:favorite", "goal"): su control enseña el spinner y el resto espera. */
    const [pending, setPending] = useState<string | null>(null)
    const busy = pending !== null
    const [error, setError] = useState('')
    const [warning, setWarning] = useState('')
    const pct = achievementPercent(game)

    async function save(key: string, action: () => Promise<void>, patch: Partial<LibraryGame>) {
        setPending(key)
        setError('')
        try {
            await action()
            update(patch)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo guardar')
        } finally {
            setPending(null)
        }
    }

    async function changeStatus(status: GameStatus) {
        if (status === game.status) return
        if (status === 'completado') {
            openComplete()
            return
        }
        setWarning('')
        await save(`status:${status}`, () => setGamesStatus([appid], status), {
            status,
            status_source: 'manual',
            suggestion: null,
            ...(status === 'jugando' && !game.started_at && { started_at: new Date().toISOString() }),
        })
        if (status === 'jugando') {
            const { count, limit } = await playingLoad(userId)
            if (count > limit) setWarning(`Ahora tienes ${count} juegos en Jugando y tu límite es ${limit}.`)
        }
    }

    const progress = goalProgress(game)
    // Con objetivo 100 %, al llegar al 100 % de logros se propone marcarlo como completado.
    const suggestComplete = !game.endless && progress.goal === 'completo' && progress.done && game.status !== 'completado'

    return (
        <section className="juego-panel glass" aria-label="Tus datos">
            <div className="juego-panel__top">
                <div className="juego-status" role="group" aria-label="Estado">
                    {GAME_STATUSES.map((s) => {
                        const Icon = LIST_ICONS[s]
                        return (
                            <button
                                key={s}
                                type="button"
                                className={`juego-status__opt st-${s}`}
                                aria-pressed={game.status === s}
                                aria-busy={pending === `status:${s}` || undefined}
                                disabled={busy}
                                onClick={() => changeStatus(s)}
                            >
                                {pending === `status:${s}` ? <Spinner /> : <Icon aria-hidden />} {STATUS_LABELS[s]}
                            </button>
                        )
                    })}
                </div>
                <div className="juego-marks" role="group" aria-label="Marcas">
                    {MARKS.map(({ mark, list, label }) => {
                        const Icon = LIST_ICONS[list]
                        const on = game[mark]
                        return (
                            <button
                                key={mark}
                                type="button"
                                className={`juego-mark st-${list}`}
                                aria-pressed={on}
                                aria-busy={pending === `mark:${mark}` || undefined}
                                disabled={busy}
                                onClick={() => save(`mark:${mark}`, () => setGameMark(appid, mark, !on), { [mark]: !on })}
                            >
                                {pending === `mark:${mark}` ? <Spinner /> : <Icon aria-hidden />} {label}
                            </button>
                        )
                    })}
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

            <dl className="hg-tiles">
                <Tile icon={<Clock aria-hidden />} tone="st-jugando" label="Horas">
                    <dd className="hg-tile__value">{formatHours(game.playtime_forever)}</dd>
                    {game.playtime_2weeks > 0 && <dd className="hg-tile__note">{formatHours(game.playtime_2weeks)} en 2 semanas</dd>}
                </Tile>
                <Tile icon={<CalendarClock aria-hidden />} tone="st-pendiente" label="Última partida">
                    <dd className="hg-tile__value">{game.rtime_last_played ? SHORT_DATE.format(new Date(game.rtime_last_played)) : 'Nunca'}</dd>
                    {game.started_at && game.status === 'jugando' && <dd className="hg-tile__note">Jugando desde el {formatDate(game.started_at)}</dd>}
                </Tile>
                <Tile icon={<Star aria-hidden />} tone={game.rating !== null ? `sc-${ratingTier(game.rating)}` : 'st-pausado'} label="Tu nota">
                    <dd className={`hg-tile__value${game.rating !== null ? ' hg-tile__value--tinted' : ''}`}>
                        {game.rating !== null ? String(game.rating).replace('.', ',') : '—'}
                    </dd>
                    <dd className="hg-tile__note">
                        {game.completed_at ? `Completado el ${formatDate(game.completed_at)}` : game.rating === null ? 'Se pone al completarlo' : null}
                    </dd>
                </Tile>
                <Tile icon={<Trophy aria-hidden />} tone="st-sin_final" label="Logros">
                    {pct === null ? (
                        <dd className="hg-tile__value">Sin logros</dd>
                    ) : (
                        <>
                            <dd className="hg-tile__value">
                                {game.achievements_unlocked ?? 0}
                                <small>/{game.achievements_total}</small>
                            </dd>
                            <dd className="hg-tile__note">
                                {isPerfect(game) ? (
                                    <span className="badge-100">
                                        <Trophy size={11} aria-hidden /> 100%
                                    </span>
                                ) : (
                                    `${pct} %`
                                )}
                                {' · '}
                                <a href="#juego-logros" className="hg-tile__link">
                                    Ver abajo
                                </a>
                            </dd>
                        </>
                    )}
                </Tile>
            </dl>

            {game.endless ? (
                <div className="juego-goal">
                    <div className="juego-goal__row">
                        <span className="juego-goal__label st-sin_final">
                            <InfinityIcon size={15} aria-hidden /> Sin final
                        </span>
                        <span className="juego-goal__value">Lo juegas por jugar: no se mide por horas ni se espera terminarlo.</span>
                    </div>
                </div>
            ) : (
                <div className="juego-goal">
                    <div className="juego-goal__row">
                        <span className="juego-goal__label">
                            <Target size={15} aria-hidden /> Objetivo
                            <Select value={parseGoal(game.goal)} onValueChange={(v) => save('goal', () => setGameGoal(appid, v as GameGoal), { goal: v })} disabled={busy}>
                                <SelectTrigger className="juego-goal__select" aria-label="Objetivo">
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
                            {pending === 'goal' && <Spinner className="juego-goal__spin" />}
                        </span>
                        <span className="juego-goal__value">
                            {progress.percent === null
                                ? 'Sin duración para medirlo'
                                : progress.basis === 'logros'
                                  ? `${progress.percent} % de logros`
                                  : `${formatHours(game.playtime_forever)} de ${formatHours(progress.targetMinutes!)} · ${progress.percent} %`}
                        </span>
                    </div>
                    {progress.basis === 'horas' && progress.percent !== null ? (
                        <DurationTrack played={game.playtime_forever} duration={duration} done={progress.done} />
                    ) : (
                        progress.percent !== null && (
                            <span className={`hg-bar juego-goal__bar${progress.done ? ' is-done' : ''}`} aria-hidden>
                                <span style={{ width: `${progress.percent}%` }} />
                            </span>
                        )
                    )}
                    {suggestComplete && (
                        <p className="juego-goal__done" role="status">
                            <Trophy size={14} aria-hidden /> ¡Objetivo cumplido: tienes todos los logros!{' '}
                            <Button size="sm" onClick={openComplete}>
                                <Flag aria-hidden /> Marcar como completado
                            </Button>
                        </p>
                    )}
                    {progress.basis === 'horas' && progress.targetMinutes !== null && duration.source && (
                        <p className="juego-panel__note">
                            {progress.targetMinutes - game.playtime_forever > 30
                                ? `Te faltan unas ${formatHours(progress.targetMinutes - game.playtime_forever)} ${GOAL_TARGET_TEXT[progress.goal]}.`
                                : `Ya has pasado la duración ${GOAL_DURATION_TEXT[progress.goal]} (${formatHours(progress.targetMinutes)}).`}{' '}
                            <span className="juego-panel__source">Según {DURATION_SOURCE_LABEL[duration.source]}.</span>
                        </p>
                    )}
                </div>
            )}
        </section>
    )
}

/** Tus horas sobre una barra con las tres metas de HowLongToBeat marcadas (historia, + extras, 100 %). */
function DurationTrack({ played, duration, done }: { played: number; duration: GameDuration; done: boolean }) {
    const marks = [
        { label: 'Historia', minutes: duration.main },
        { label: '+ extras', minutes: duration.mainExtra },
        { label: '100 %', minutes: duration.completionist },
    ].filter((m): m is { label: string; minutes: number } => m.minutes !== null)
    const max = Math.max(played, ...marks.map((m) => m.minutes))
    if (max <= 0) return null
    const at = (minutes: number) => `${Math.min(100, (minutes / max) * 100)}%`
    return (
        <div className="juego-track" aria-hidden>
            <span className={`juego-track__fill${done ? ' is-done' : ''}`} style={{ width: at(played) }} />
            {marks.map((m, i) => (
                <span
                    key={m.label}
                    className={`juego-track__mark${played >= m.minutes ? ' is-passed' : ''}${i === marks.length - 1 && m.minutes === max ? ' is-last' : ''}`}
                    style={{ left: at(m.minutes) }}
                >
                    <span>
                        {m.label} {formatHours(m.minutes)}
                    </span>
                </span>
            ))}
        </div>
    )
}

// ─── No lo tienes ────────────────────────────────────────────────────────────

const SHORT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const when = (iso: string | null) => (iso ? SHORT.format(new Date(iso)) : null)

function BuyPanel({ duration, achievementsTotal, storeUrl }: Props) {
    const { appid, state, reload } = useGame()
    const [pending, setPending] = useState<'favorite' | 'pending' | 'wish' | null>(null)
    const busy = pending !== null
    const [error, setError] = useState('')
    if (state.kind !== 'no_lo_tienes') return null
    const { pending: inPending, wish, price } = state

    /** Guarda y vuelve a leer el estado; el spinner sigue hasta que la ficha ya enseña el cambio. */
    async function run(key: NonNullable<typeof pending>, action: () => Promise<void>) {
        setPending(key)
        setError('')
        try {
            await action()
            await reload()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo guardar')
        } finally {
            setPending(null)
        }
    }

    const story = duration.main
    const euroPerHour = euroPerHourOf(price?.price_final ?? null, story)

    return (
        <div className="juego-buy">
            <section className="juego-panel glass juego-buy__price" aria-label="Precio">
                <div className="juego-buy__state">
                    {inPending && <StatusChip status="pendiente" />}
                    <span className="lib-own lib-own--no">
                        <ShoppingCart aria-hidden /> {inPending ? 'Sin comprar' : 'No lo tienes'}
                    </span>
                    {wish && (
                        <span className="juego-buy__wish">
                            <Heart size={13} aria-hidden /> En tu wishlist{wish.source === 'steam' ? ' de Steam' : ''}
                        </span>
                    )}
                </div>

                {price ? <PriceBlock price={price} /> : <p className="juego-panel__note">Aún no hay datos de precio de este juego.</p>}

                {error && (
                    <p className="alert alert--error" role="alert">
                        {error}
                    </p>
                )}

                <div className="juego-panel__actions">
                    <Button asChild>
                        <a href={storeUrl} target="_blank" rel="noreferrer">
                            <ShoppingCart aria-hidden /> Comprar en Steam
                        </a>
                    </Button>
                    {inPending ? (
                        <>
                            <button
                                type="button"
                                className="juego-mark st-favorito"
                                aria-pressed={inPending.favorite}
                                aria-busy={pending === 'favorite' || undefined}
                                disabled={busy}
                                onClick={() => run('favorite', () => setGameMark(appid, 'favorite', !inPending.favorite))}
                            >
                                {pending === 'favorite' ? <Spinner /> : <Heart aria-hidden />} Favorito
                            </button>
                            <Button variant="ghost" loading={pending === 'pending'} disabled={busy} onClick={() => run('pending', () => removeFromPending(appid))}>
                                <BookmarkX aria-hidden /> Quitar de Pendientes
                            </Button>
                        </>
                    ) : (
                        <Button variant="secondary" loading={pending === 'pending'} disabled={busy} onClick={() => run('pending', () => addToPending(appid))}>
                            <BookmarkPlus aria-hidden /> Añadir a Pendientes
                        </Button>
                    )}
                    {wish?.source === 'steam' ? (
                        <Button variant="ghost" asChild>
                            <Link href="/wishlist">
                                <Heart aria-hidden /> Ver la wishlist
                            </Link>
                        </Button>
                    ) : (
                        <Button variant="ghost" loading={pending === 'wish'} disabled={busy} onClick={() => run('wish', () => (wish ? removeFromWishlist(appid) : addToWishlist(appid)))}>
                            {wish ? <HeartOff aria-hidden /> : <Heart aria-hidden />} {wish ? 'Quitar de la wishlist' : 'Añadir a la wishlist'}
                        </Button>
                    )}
                </div>
            </section>

            <section className="juego-panel glass juego-buy__duration" aria-labelledby="juego-dura">
                <h2 id="juego-dura" className="juego__section-title">
                    <Hourglass size={16} className="st-pendiente juego-buy__title-icon" aria-hidden /> Lo que dura
                </h2>
                {duration.source ? (
                    <>
                        <DurationBars duration={duration} />
                        <p className="juego-panel__note">Según {DURATION_SOURCE_LABEL[duration.source]}.</p>
                    </>
                ) : (
                    <p className="juego-panel__note">Sin datos de duración.</p>
                )}
                <dl className="juego-buy__mini">
                    <div>
                        <dt>Logros en Steam</dt>
                        <dd>{achievementsTotal ?? '—'}</dd>
                    </div>
                    <div>
                        <dt>Precio por hora de historia</dt>
                        <dd className={euroPerHour !== null ? `sc-${costPerHourTier(euroPerHour)} juego-buy__tinted` : undefined}>
                            {euroPerHour !== null ? `${euroPerHour.toFixed(2).replace('.', ',')} €/h` : '—'}
                        </dd>
                    </div>
                </dl>
            </section>
        </div>
    )
}

/** Precio de hoy en grande, veredicto (mínimo histórico en amarillo), regla de precios y mínimos de IsThereAnyDeal. */
function PriceBlock({ price }: { price: PriceData }) {
    if (price.price_final === null) {
        return <p className="juego-buy__big">{price.is_free ? 'Gratis' : price.coming_soon ? 'Próximamente' : 'Sin precio'}</p>
    }
    const onSale = (price.discount_percent ?? 0) > 0
    const verdict = priceVerdict(price)
    const rule = priceRule(price)

    return (
        <>
            <div className="juego-buy__now">
                {onSale && <span className="juego-buy__cut hg-tint sc-top">-{price.discount_percent} %</span>}
                <span className="juego-buy__big">{formatPrice(price.price_final)}</span>
                {onSale && <s className="juego-buy__was">{formatPrice(price.price_initial)}</s>}
            </div>

            {verdict === 'low' ? (
                <p className="juego-verdict juego-verdict--deal">
                    <TrendingDown aria-hidden /> En mínimo histórico en Steam <span>· nunca ha estado más barato aquí</span>
                </p>
            ) : verdict === 'sale' && price.steam_low !== null ? (
                <p className="juego-verdict hg-tint sc-mid">
                    <AlertTriangle aria-hidden /> Rebajado, pero ha estado más barato <span>· mínimo en Steam: {formatPrice(price.steam_low)}</span>
                </p>
            ) : price.steam_low !== null && price.steam_low < price.price_final ? (
                <p className="juego-verdict juego-verdict--plain">
                    Precio normal <span>· ha llegado a {formatPrice(price.steam_low)} en Steam</span>
                </p>
            ) : null}

            {rule !== null && (
                <div className="juego-range" aria-label={`Precio de hoy entre el mínimo (${formatPrice(rule.floor)}) y el precio normal (${formatPrice(rule.regular)})`}>
                    <div className="juego-range__track" style={{ '--low': `${rule.steamLowAt}%` } as CSSVars}>
                        <span
                            className={`juego-range__pt${rule.position < 15 ? ' is-start' : rule.position > 85 ? ' is-end' : ''}`}
                            style={{ left: `${rule.position}%` }}
                        >
                            <b>Hoy {formatPrice(price.price_final)}</b>
                        </span>
                    </div>
                    <div className="juego-range__labels">
                        <span>
                            Mínimo
                            <b>{formatPrice(rule.floor)}</b>
                        </span>
                        <span>
                            Precio normal
                            <b>{formatPrice(rule.regular)}</b>
                        </span>
                    </div>
                </div>
            )}

            {(price.steam_low !== null || price.all_low !== null) && (
                <dl className="juego-lows">
                    {price.steam_low !== null && (
                        <div className={verdict === 'low' ? 'is-hit' : undefined}>
                            <dt>Mínimo en Steam</dt>
                            <dd>{formatPrice(price.steam_low)}</dd>
                            {price.steam_low_at && <dd className="juego-lows__when">{when(price.steam_low_at)}</dd>}
                        </div>
                    )}
                    {price.all_low !== null && (
                        <div>
                            <dt>Mínimo en cualquier tienda</dt>
                            <dd>{formatPrice(price.all_low)}</dd>
                            <dd className="juego-lows__when">
                                {[price.all_low_shop, when(price.all_low_at)].filter(Boolean).join(' · ')}
                                {price.itad_id && (
                                    <>
                                        {' · '}
                                        <a href={itadUrl(price.itad_id)} target="_blank" rel="noreferrer" title="Historial de precios en IsThereAnyDeal">
                                            <LineChart size={12} aria-hidden /> Historial
                                        </a>
                                    </>
                                )}
                            </dd>
                        </div>
                    )}
                </dl>
            )}
        </>
    )
}

function DurationBars({ duration }: { duration: GameDuration }) {
    const rows = [
        { label: 'Historia', minutes: duration.main, tone: 'st-pendiente' },
        { label: 'Historia + extras', minutes: duration.mainExtra, tone: 'st-jugando' },
        { label: '100 %', minutes: duration.completionist, tone: 'st-sin_final' },
    ].filter((r): r is { label: string; minutes: number; tone: string } => r.minutes !== null)
    const max = Math.max(...rows.map((r) => r.minutes))
    return (
        <dl className="juego-dur">
            {rows.map((r) => (
                <div key={r.label} className={`juego-dur__row ${r.tone}`}>
                    <dt>{r.label}</dt>
                    <dd className="hg-bar" aria-hidden>
                        <span style={{ width: `${(r.minutes / max) * 100}%` }} />
                    </dd>
                    <dd className="juego-dur__value">{formatHours(r.minutes)}</dd>
                </div>
            ))}
        </dl>
    )
}


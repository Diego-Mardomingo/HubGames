'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, ArrowRight, BookmarkPlus, Check, Clock, Heart, LogIn, Share2, TrendingDown, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { judiShareText, resultSummary, type JudiAttempt, type JudiHints, type JudiSlot } from '@/lib/judi'
import { metacriticScore, priceVerdict, steamReviewScore } from '@/lib/scores'
import { pendingAction, canWishlist } from '@/lib/game-search'
import { addToPending, setGamesStatus, type GameStatus } from '@/lib/tracker'
import { addToWishlist, formatPrice } from '@/lib/wishlist'
import { WISHLIST_CHANGED_EVENT } from '@/lib/nav-status'
import { storePrice } from '@/lib/store-price'
import { Button } from '@/components/ui/button'
import CountUp from '@/components/CountUp'
import { MarkFlags, StatusChip } from '@/components/tracker/status'
import type { PriceData } from '@/components/wishlist/PriceInfo'
import { loadGameState } from '@/app/juego/[appid]/GameContext'
import { AttemptPips } from './JudiAttempts'

/** Lo que sabemos del juego revelado: lo de la ficha (tu lista, marcas, wishlist, precio) y su Metacritic. */
type Card = {
    loggedIn: boolean
    metacritic: number | null
    status: GameStatus | null
    favorite: boolean
    endless: boolean
    owned: boolean
    wished: boolean
    price: PriceData | null
}

/** Precio de tienda (`price_overview`) como PriceData, sin mínimos: sin sesión o sin fila en hubgames_game_prices. */
function storePriceData(raw: unknown, isFree: boolean, comingSoon: boolean): PriceData | null {
    const p = storePrice(raw)
    if (!p && !isFree && !comingSoon) return null
    return {
        price_initial: p?.initial ?? null,
        price_final: p?.final ?? null,
        discount_percent: p?.discount_percent ?? null,
        is_free: isFree,
        coming_soon: comingSoon,
        itad_id: null,
        steam_low: null,
        steam_low_at: null,
        all_low: null,
        all_low_shop: null,
        all_low_at: null,
    }
}

async function loadCard(appid: number): Promise<Card> {
    const { data: cat } = await supabase
        .from('hubgames_juegos_steam')
        .select('metacritic_score, is_free, coming_soon, price_overview')
        .eq('steam_appid', appid)
        .maybeSingle()
    const isFree = cat?.is_free ?? false
    const comingSoon = cat?.coming_soon ?? false
    const state = await loadGameState(appid, storePrice(cat?.price_overview), isFree, comingSoon)
    const base = { metacritic: cat?.metacritic_score ?? null, favorite: false, endless: false, owned: false, wished: false, status: null }
    if (state.kind === 'ok') {
        const g = state.game
        return { ...base, loggedIn: true, status: g.status, favorite: g.favorite, endless: g.endless, owned: true, price: null, metacritic: g.metacritic_score ?? base.metacritic }
    }
    if (state.kind === 'no_lo_tienes') {
        const g = state.pending
        return {
            ...base,
            loggedIn: true,
            status: g?.status ?? null,
            favorite: g?.favorite ?? false,
            endless: g?.endless ?? false,
            wished: !!state.wish,
            price: state.price,
        }
    }
    return { ...base, loggedIn: false, price: storePriceData(cat?.price_overview, isFree, comingSoon) }
}

/** Precio con su veredicto, como en la ficha: mínimo histórico en amarillo, rebajado pero ha estado más barato en ámbar. */
function PriceLine({ price }: { price: PriceData }) {
    if (price.price_final === null) {
        return <p className="jd-card__price jd-card__price--none">{price.is_free ? 'Gratis' : price.coming_soon ? 'Próximamente' : 'Sin precio'}</p>
    }
    const onSale = (price.discount_percent ?? 0) > 0
    const verdict = priceVerdict(price)
    const hasLows = price.steam_low !== null
    return (
        <>
            <p className="jd-card__price">
                {onSale && <span className="jd-card__cut hg-tint sc-top">-{price.discount_percent} %</span>}
                <strong>{formatPrice(price.price_final)}</strong>
                {onSale && <s>{formatPrice(price.price_initial)}</s>}
                {!hasLows && <span className="jd-card__store">Precio en Steam</span>}
            </p>
            {verdict === 'low' ? (
                <p className="jd-verdict jd-verdict--deal">
                    <TrendingDown aria-hidden /> Mínimo histórico <span>Nunca ha estado más barato en Steam</span>
                </p>
            ) : verdict === 'sale' && hasLows ? (
                <p className="jd-verdict hg-tint sc-mid">
                    <AlertTriangle aria-hidden /> Rebajado <span>Ha estado a {formatPrice(price.steam_low)} en Steam</span>
                </p>
            ) : null}
        </>
    )
}

/**
 * Resultado al terminar un JUDI: titular con los puntos que cuentan, la tarjeta del juego como en la ficha (portada que
 * se revela, tu lista o la wishlist, Metacritic, reseñas y precio con veredicto), las acciones del buscador (Pendientes,
 * Wishlist, Ver ficha), compartir, la cuenta atrás si es el de hoy e Historial / Siguiente reto.
 */
export default function JudiResult({
    state,
    attempts,
    exact,
    slots,
    game,
    hints,
    animate,
    countdown,
    onBack,
    onNext,
}: {
    state: 'won' | 'lost'
    attempts: JudiAttempt[]
    exact: boolean
    slots: JudiSlot[]
    game: { id: number; fecha: string; nombre?: string | null; header_image?: string | null; appid?: number | null }
    hints: JudiHints
    /** false al volver a entrar en una partida terminada: sin animaciones. */
    animate: boolean
    countdown: string | null
    onBack: () => void
    onNext: (() => void) | null
}) {
    const appid = game.appid ?? null
    const [card, setCard] = useState<Card | null>(null)
    const [saving, setSaving] = useState<'pend' | 'wish' | null>(null)
    const [did, setDid] = useState<'pend' | 'wish' | null>(null)
    const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

    useEffect(() => {
        if (!appid) return
        let cancelled = false
        void loadCard(appid).then((c) => !cancelled && setCard(c))
        return () => {
            cancelled = true
        }
    }, [appid])

    const won = state === 'won'
    const points = won ? Math.max(6 - attempts.length, 1) : 0
    const summary = resultSummary(state, attempts, exact)
    const mc = card?.metacritic != null ? metacriticScore(card.metacritic) : null
    const reviews = hints.positivas != null ? steamReviewScore(hints.positivas) : null

    async function addPending() {
        if (!appid || !card) return
        setSaving('pend')
        setMessage(null)
        try {
            // Si ya lo sigues, cambia de lista; si no, entra como pendiente sin comprar (como en el buscador).
            if (card.status) await setGamesStatus([appid], 'pendiente')
            else await addToPending(appid)
            setCard({ ...card, status: 'pendiente' })
            setDid('pend')
        } catch (e) {
            setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo añadir a Pendientes' })
        } finally {
            setSaving(null)
        }
    }

    async function addWish() {
        if (!appid || !card) return
        setSaving('wish')
        setMessage(null)
        try {
            await addToWishlist(appid)
            setCard({ ...card, wished: true })
            setDid('wish')
            window.dispatchEvent(new Event(WISHLIST_CHANGED_EVENT))
        } catch (e) {
            setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'No se pudo añadir a la wishlist' })
        } finally {
            setSaving(null)
        }
    }

    async function share() {
        const text = judiShareText(game, state, attempts.length, `${window.location.origin}/judi`)
        setMessage(null)
        try {
            if (navigator.share) {
                await navigator.share({ text })
                return
            }
            await navigator.clipboard.writeText(text)
            setMessage({ tone: 'ok', text: 'Resultado copiado' })
        } catch (e) {
            // Cerrar el diálogo de compartir no es un error.
            if (e instanceof DOMException && e.name === 'AbortError') return
            try {
                await navigator.clipboard.writeText(text)
                setMessage({ tone: 'ok', text: 'Resultado copiado' })
            } catch {
                setMessage({ tone: 'error', text: 'No se pudo compartir' })
            }
        }
    }

    const pend = card?.loggedIn ? pendingAction(card.status ?? undefined) : null

    return (
        <div className={`jd-result jd-result--${state}${animate ? ' jd-fx-in' : ''}`} role="status">
            <div className="jd-result__head">
                <span className={`jd-result__icon${animate ? ' jd-fx-hit' : ''}`} aria-hidden>
                    {won ? <Check strokeWidth={3} /> : <X strokeWidth={3} />}
                </span>
                <div className="jd-result__titles">
                    <p className="jd-result__status">{summary.title}</p>
                    <p className="jd-result__detail">{summary.detail}</p>
                </div>
                <p className="jd-result__pts">
                    {won && animate ? <CountUp value={points} className="jd-result__num" /> : <b className="jd-result__num">{points}</b>}
                    <small>{points === 1 ? 'punto' : 'puntos'}</small>
                </p>
            </div>

            <article className="jd-card">
                {game.header_image && (
                    <div className={`jd-card__art${animate ? ' jd-fx-reveal' : ''}`}>
                        <img src={game.header_image} alt="" draggable={false} />
                    </div>
                )}
                <div className="jd-card__body">
                    <span className="jd-card__label">{won ? 'Era' : 'El juego era'}</span>
                    <h2 className="jd-card__name">{appid ? <Link href={`/juego/${appid}`}>{game.nombre}</Link> : game.nombre}</h2>
                    {card?.loggedIn && (
                        <div className="jd-card__row">
                            {card.status ? (
                                <span key={did === 'pend' ? 'pend' : 'st'} className={did === 'pend' ? 'hg-pop-in jd-card__swap' : undefined}>
                                    <StatusChip status={card.status} />
                                </span>
                            ) : card.wished ? (
                                <span className={`jd-card__wished${did === 'wish' ? ' hg-pop-in' : ''}`}>
                                    <Heart aria-hidden /> En tu wishlist
                                </span>
                            ) : (
                                <span className="jd-card__none">No lo tienes</span>
                            )}
                            <MarkFlags favorite={card.favorite} endless={card.endless} />
                            {card.status && !card.owned && <span className="lib-own--no">Sin comprar</span>}
                        </div>
                    )}
                    {(mc || reviews) && (
                        <div className="jd-card__row">
                            {mc && card?.metacritic != null && (
                                <span className="jd-card__score">
                                    <span className={`hg-score hg-tint sc-${mc.tier}`}>{card.metacritic}</span>
                                    <span>
                                        <b>Metacritic</b> · {mc.label}
                                    </span>
                                </span>
                            )}
                            {reviews && (
                                <span className="jd-card__score">
                                    <span className={`hg-score hg-tint sc-${reviews.tier}`}>{hints.positivas} %</span>
                                    <span>{reviews.label}</span>
                                </span>
                            )}
                        </div>
                    )}
                    {card?.price && !card.owned && <PriceLine price={card.price} />}
                    <div className="jd-card__acts">
                        {card && !card.loggedIn && (
                            <div className="jd-card__guest">
                                <p>Inicia sesión para guardar tus partidas en tu cuenta y añadir este juego a tus pendientes o a tu wishlist.</p>
                                <Button asChild size="sm" variant="secondary">
                                    <Link href="/login">
                                        <LogIn aria-hidden /> Iniciar sesión
                                    </Link>
                                </Button>
                            </div>
                        )}
                        {pend === 'done' ? (
                            did === 'pend' && (
                                <span className="jd-card__done hg-tint st-pendiente hg-count--pop" role="status">
                                    <Check aria-hidden className="hg-draw" /> En Pendientes
                                </span>
                            )
                        ) : pend ? (
                            <Button size="sm" variant="secondary" className="jd-card__pend" loading={saving === 'pend'} disabled={saving !== null} onClick={() => void addPending()}>
                                <BookmarkPlus aria-hidden /> {pend === 'move' ? 'A Pendientes' : 'Pendientes'}
                            </Button>
                        ) : null}
                        {did === 'wish' ? (
                            <span className="jd-card__done jd-card__done--wish" role="status">
                                <Heart aria-hidden className="hg-beat" /> En la wishlist
                            </span>
                        ) : card?.loggedIn && canWishlist(card.status ?? undefined, card.wished) ? (
                            <Button size="sm" variant="ghost" loading={saving === 'wish'} disabled={saving !== null} onClick={() => void addWish()}>
                                <Heart aria-hidden /> Wishlist
                            </Button>
                        ) : null}
                        {appid && (
                            <Link href={`/juego/${appid}`} className="jd-card__open">
                                Ver ficha <ArrowRight aria-hidden />
                            </Link>
                        )}
                    </div>
                </div>
            </article>

            <div className="jd-result__foot">
                <div className="jd-result__share">
                    <Button size="sm" variant="secondary" onClick={() => void share()}>
                        <Share2 aria-hidden /> Compartir <AttemptPips slots={slots} size="sm" />
                    </Button>
                    {message ? (
                        <span className={`jd-result__msg jd-result__msg--${message.tone}`} role="status">
                            {message.tone === 'ok' ? <Check aria-hidden className="hg-draw" /> : <AlertTriangle aria-hidden />}
                            {message.text}
                        </span>
                    ) : countdown ? (
                        <span className="jd-result__countdown" role="timer">
                            <Clock aria-hidden /> Nuevo JUDI en <b>{countdown}</b>
                        </span>
                    ) : null}
                </div>
                <div className="jd-result__actions">
                    <Button variant="secondary" onClick={onBack}>
                        <ArrowLeft size={15} data-icon="inline-start" aria-hidden />
                        Historial
                    </Button>
                    {onNext && (
                        <Button onClick={onNext}>
                            Siguiente reto
                            <ArrowRight size={15} data-icon="inline-end" aria-hidden />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}

'use client'

import Link from 'next/link'
import { AlertTriangle, BellOff, Bell, CalendarDays, Check, ExternalLink, Hourglass, ThumbsDown, ThumbsUp, Trash2, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import GameCover from '@/components/tracker/GameCover'
import { MarkFlags, StatusChip } from '@/components/tracker/status'
import PriceAlertControl from '@/components/wishlist/PriceAlertControl'
import { DURATION_SOURCE_LABEL } from '@/lib/library'
import { alertLabel, alertTarget, meetsAlert, type PriceAlert } from '@/lib/price-alerts'
import { costPerHourTier, metacriticScore, priceRule, steamReviewScore } from '@/lib/scores'
import { formatHours } from '@/lib/format'
import type { GameStatus } from '@/lib/tracker'
import { formatPrice, isOnSale, type WishlistGame } from '@/lib/wishlist'
import { formatEuroPerHour, rowFacts } from '@/lib/wishlist-list'
import './wishlist.css'

/** El juego también está en tu Biblioteca (sin comprar: la wishlist no enseña los que tienes en Steam). */
export interface LibraryEntry {
    status: GameStatus
    favorite: boolean
    endless: boolean
}

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>

const DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

/** Duración de la historia, Metacritic y reseñas con su color y su palabra, y € por hora de historia. */
function RowScores({ game }: { game: WishlistGame }) {
    const { duration, euroPerHour } = rowFacts(game)
    const mc = game.metacritic_score !== null ? metacriticScore(game.metacritic_score) : null
    const rev = game.steamspy_userscore !== null && game.steamspy_userscore > 0 ? steamReviewScore(game.steamspy_userscore) : null
    if (duration.main === null && !mc && !rev) return <span>Sin datos de duración ni notas todavía</span>
    return (
        <>
            {duration.main !== null && duration.source && (
                <span className="lib-meta" title={`Historia (${DURATION_SOURCE_LABEL[duration.source]})`}>
                    <Hourglass aria-hidden /> {formatHours(duration.main)}
                </span>
            )}
            {mc && (
                <span className="wl-mc" title={`Metacritic: ${mc.label}`}>
                    <span className="wl-mc__lbl">Metacritic</span>
                    <span className={`hg-score hg-tint sc-${mc.tier}`}>{game.metacritic_score}</span>
                </span>
            )}
            {rev && (
                <span className="wl-rev" title={`Reseñas de Steam: ${rev.label} (${game.steamspy_userscore} %)`}>
                    <span className={`hg-score hg-tint sc-${rev.tier}`}>
                        {rev.tier === 'bad' ? <ThumbsDown aria-hidden /> : <ThumbsUp aria-hidden />}
                        {game.steamspy_userscore} %
                    </span>
                    <span className="wl-rev__label">{rev.label}</span>
                </span>
            )}
            {euroPerHour !== null && (
                <span className={`wl-eph hg-tint sc-${costPerHourTier(euroPerHour)}`} title="Precio por hora de historia">
                    {formatEuroPerHour(euroPerHour)}
                </span>
            )}
        </>
    )
}

/** Etiqueta del aviso en la fila: propio en cobalto (en verde si hoy se cumple) o «Sin avisos» en gris. */
function AlertChip({ game, alert, fresh }: { game: WishlistGame; alert: PriceAlert | null; fresh: boolean }) {
    const pop = fresh ? ' is-new' : ''
    if (alert?.mode === 'off') {
        return (
            <span className={`wl-alert is-off${pop}`}>
                <BellOff aria-hidden /> Sin avisos
            </span>
        )
    }
    const target = alertTarget(alert)
    if (!alert || !target) return null
    if (meetsAlert(game, alert)) {
        return (
            <span className={`wl-alert hg-tint sc-top${pop}`} title="El precio de hoy cumple tu aviso">
                <Check aria-hidden /> Cumple tu aviso · {target}
            </span>
        )
    }
    return (
        <span className={`wl-alert hg-tint st-todos${pop}`}>
            <Bell aria-hidden /> {alertLabel(alert)}
        </span>
    )
}

/** Veredicto del precio: mínimo histórico en amarillo, «Ha estado a…» en ámbar o neutro. */
function Verdict({ game }: { game: WishlistGame }) {
    const { verdict } = rowFacts(game)
    if (verdict === 'low') {
        return (
            <span className="hg-deal" title="El precio de hoy es el más bajo que ha tenido en Steam">
                <TrendingDown aria-hidden /> Mínimo histórico
            </span>
        )
    }
    if (verdict === 'sale' && game.steam_low !== null) {
        return (
            <span className="wl-verdict__tag hg-tint sc-mid" title="Rebajado, pero ha estado más barato en Steam">
                <AlertTriangle aria-hidden /> Ha estado a {formatPrice(game.steam_low)}
            </span>
        )
    }
    return <span className="wl-verdict__tag wl-plain">{verdict === 'sale' ? 'Rebajado' : 'Precio normal'}</span>
}

/**
 * Regla de precios pequeña (la de la ficha): de lo más barato que ha estado en cualquier tienda al precio normal, con el
 * tramo amarillo hasta el mínimo de Steam y un punto en el precio de hoy. Si el mínimo es de otra tienda, se nombra.
 */
function PriceRuleMini({ game, low }: { game: WishlistGame; low: boolean }) {
    const rule = priceRule(game)
    if (!rule) {
        return game.steam_low === null && game.all_low === null ? <div className="wl-rule--none">Sin historial de precios</div> : null
    }
    const shop = game.all_low !== null && game.all_low_shop ? ` en ${game.all_low_shop}` : game.all_low === null ? ' en Steam' : ''
    const tip = `Hoy ${formatPrice(game.price_final)} · lo más barato: ${formatPrice(rule.floor)}${shop} · precio normal ${formatPrice(rule.regular)}`
    // Si otra tienda lo ha tenido más barato que Steam, se dice: «Mínimo histórico» habla solo de Steam.
    const otherShop = game.all_low !== null && game.steam_low !== null && game.all_low < game.steam_low ? (game.all_low_shop ?? 'otra tienda') : null
    return (
        <div className={`wl-rule${low ? ' is-low' : ''}`} title={tip} role="img" aria-label={tip}>
            <div className="wl-rule__track" style={{ '--lw': `${rule.steamLowAt}%` } as CSSVars}>
                <span className="wl-rule__low" />
                <span className="wl-rule__pos" style={{ '--p': `${rule.position}%` } as CSSVars}>
                    <span className="wl-rule__dot" />
                </span>
            </div>
            <div className="wl-rule__labels" aria-hidden>
                <span className="wl-rule__min">
                    <span>
                        Mín. <b>{formatPrice(rule.floor)}</b>
                    </span>
                    {otherShop && <span className="wl-rule__shop">en {otherShop}</span>}
                </span>
                <span>
                    Normal <b>{formatPrice(rule.regular)}</b>
                </span>
            </div>
        </div>
    )
}

function RowPrice({ game }: { game: WishlistGame }) {
    if (game.price_final === null) {
        const soon = game.coming_soon
        return (
            <div className="wl-price wl-price--none">
                <b>{game.is_free ? 'Gratis' : soon ? 'Próximamente' : 'Sin precio'}</b>
                {soon && game.release_date_text && <span>Sale: {game.release_date_text}</span>}
            </div>
        )
    }
    const sale = isOnSale(game)
    const { verdict } = rowFacts(game)
    return (
        <div className="wl-price">
            <div className="wl-price__top">
                <div className="wl-price__now">
                    {sale && <span className="wl-cut hg-tint sc-top">-{game.discount_percent} %</span>}
                    <span className="wl-big">{formatPrice(game.price_final)}</span>
                    {sale && <s className="wl-was">{formatPrice(game.price_initial)}</s>}
                </div>
                <div className="wl-verdict">
                    <Verdict game={game} />
                </div>
            </div>
            <PriceRuleMini game={game} low={verdict === 'low'} />
        </div>
    )
}

export default function WishlistRow({
    game,
    priority,
    userId,
    alert,
    library,
    freshAlert,
    onAlertSaved,
    onRemove,
}: {
    game: WishlistGame
    priority: boolean
    userId: string | null
    alert: PriceAlert | null
    library: LibraryEntry | null
    /** El aviso se acaba de guardar: su etiqueta entra con un pop. */
    freshAlert: boolean
    onAlertSaved: (alert: PriceAlert) => void
    onRemove: () => void
}) {
    const name = game.name ?? `App ${game.appid}`
    const { verdict } = rowFacts(game)
    return (
        <div className={`hg-row wl-row v-${verdict ?? 'none'}`}>
            <span className="hg-row__cover">
                <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="header" sizes="112px" priority={priority} />
            </span>
            <div className="wl-main">
                <div className="wl-name">
                    <Link href={`/juego/${game.appid}`} className="hg-row__link" data-row-link>
                        {name}
                    </Link>
                    {library && (
                        <span className="wl-lib" title="También en tu Biblioteca, sin comprar">
                            <StatusChip status={library.status} />
                            <MarkFlags favorite={library.favorite} endless={library.endless} />
                        </span>
                    )}
                </div>
                <div className="wl-meta">
                    <RowScores game={game} />
                </div>
                <div className="wl-meta wl-meta--sub">
                    <span>
                        {game.source === 'steam' ? 'Wishlist de Steam' : 'Añadido en HubGames'} · {DATE.format(new Date(game.date_added)).replace('.', '')}
                    </span>
                    {game.price_final === null && game.coming_soon && game.release_date_text && (
                        <span className="wl-soon">
                            <CalendarDays aria-hidden /> Sale: {game.release_date_text}
                        </span>
                    )}
                    <AlertChip game={game} alert={alert} fresh={freshAlert} />
                </div>
            </div>
            <RowPrice game={game} />
            <div className="wl-actions">
                {userId && <PriceAlertControl game={game} userId={userId} name={name} alert={alert} onSaved={onAlertSaved} />}
                <Button size="icon" variant="ghost" asChild>
                    <a href={`https://store.steampowered.com/app/${game.appid}/`} target="_blank" rel="noreferrer" aria-label={`${name} en la tienda de Steam`} title="Ver en la tienda de Steam">
                        <ExternalLink aria-hidden />
                    </a>
                </Button>
                {game.source === 'manual' ? (
                    <Button size="icon" variant="ghost" className="wl-trash" onClick={onRemove} aria-label={`Quitar ${name} de la wishlist`} title="Quitar de la wishlist">
                        <Trash2 aria-hidden />
                    </Button>
                ) : (
                    <span className="wl-actions__gap" aria-hidden />
                )}
            </div>
        </div>
    )
}

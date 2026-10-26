'use client'

import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Dices, ExternalLink, Hourglass, Infinity as InfinityIcon, Play, RefreshCw, ShoppingCart, ThumbsUp } from 'lucide-react'
import { MOOD_LABELS, SESSION_LABELS, recommend, type Mood, type SessionLength } from '@/lib/recommend'
import { steamRunUrl } from '@/lib/dashboard'
import { gameDuration } from '@/lib/library'
import { formatHours } from '@/lib/format'
import { metacriticScore, steamReviewScore } from '@/lib/scores'
import type { LibraryGame } from '@/lib/tracker'
import { Button } from '@/components/ui/button'
import GameCover from '@/components/tracker/GameCover'
import { MarkFlags, StatusChip } from '@/components/tracker/status'
import { PriceTag } from '@/components/wishlist/PriceInfo'

const SHOWN = 3
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

/** Cómo cambian las propuestas: barajar (se recogen en un mazo y se reparten), fundido (filtros) u «Otra» (una fila). */
type Change = { kind: 'deal' } | { kind: 'fade' } | { kind: 'one'; slot: number }

function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Control segmentado con el fondo activo que se desliza (`layoutId`). */
function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Record<T, string>; onChange: (v: T) => void }) {
    const id = useId()
    return (
        <div className="wtp-choice" role="radiogroup" aria-label={label}>
            <span className="wtp-choice__label">{label}</span>
            <div className="hg-seg hg-seg--slide">
                {(Object.keys(options) as T[]).map((key) => (
                    <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={value === key}
                        className={`hg-seg__opt ${value === key ? 'is-active' : ''}`}
                        onClick={() => onChange(key)}
                    >
                        {value === key && <motion.span layoutId={`${id}-thumb`} className="hg-seg__thumb" transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} />}
                        <span className="hg-seg__text">{options[key]}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}

function Facts({ game }: { game: LibraryGame }) {
    const main = gameDuration(game).main
    const mc = game.metacritic_score !== null ? metacriticScore(game.metacritic_score) : null
    const rev = game.steamspy_userscore ? steamReviewScore(game.steamspy_userscore) : null
    return (
        <span className="hg-row__meta lib-row__meta">
            {game.endless ? (
                <span className="lib-meta dash-endless">
                    <InfinityIcon aria-hidden /> Sin final
                </span>
            ) : (
                main !== null && (
                    <span className="lib-meta" title="Duración de la historia">
                        <Hourglass aria-hidden /> {formatHours(main)}
                    </span>
                )
            )}
            {mc && (
                <span className={`hg-score hg-tint sc-${mc.tier}`} title={`Metacritic: ${mc.label}`}>
                    {game.metacritic_score}
                </span>
            )}
            {rev && (
                <span className={`hg-score hg-tint sc-${rev.tier}`} title={`Reseñas de Steam: ${rev.label}`}>
                    <ThumbsUp aria-hidden /> {Math.round(game.steamspy_userscore!)} %<span className="sr-only"> ({rev.label})</span>
                </span>
            )}
        </span>
    )
}

/**
 * "¿Qué juego hoy?" (#30): 3 propuestas de tus Jugando y Pendientes según el tiempo y las ganas. Los pendientes sin
 * comprar (`unowned`) solo entran en «Empezar algo nuevo», con su precio y «Ver en Steam».
 * `now` y `initialSeed` vienen del servidor para que el primer render coincida al hidratar.
 */
export default function WhatToPlay({ games, unowned = [], now, initialSeed }: { games: LibraryGame[]; unowned?: LibraryGame[]; now: number; initialSeed: number }) {
    const [session, setSession] = useState<SessionLength>('media')
    const [mood, setMood] = useState<Mood>('terminar')
    const [seed, setSeed] = useState(initialSeed)
    // Posición en la lista de propuestas que enseña cada hueco; "Otra" lo mueve a la siguiente que no esté a la vista.
    const [slots, setSlots] = useState<number[]>([0, 1, 2])
    const listRef = useRef<HTMLUListElement>(null)
    const change = useRef<Change | null>(null)
    const busy = useRef(false)

    const pool = useMemo(() => (unowned.length ? [...games, ...unowned] : games), [games, unowned])
    const list = useMemo(() => recommend(pool, session, mood, now, seed), [pool, session, mood, now, seed])
    const visible = slots.filter((i) => i < list.length)
    const shownKey = visible.map((i) => list[i]?.game.appid).join(',')

    /** Saca las filas actuales con su animación y, al terminar, aplica el cambio. */
    async function animate(next: Change, apply: () => void) {
        const ul = listRef.current
        if (busy.current) return
        if (!ul || reducedMotion()) {
            apply()
            return
        }
        busy.current = true
        const rows = [...ul.children] as HTMLElement[]
        const mid = (rows.length - 1) / 2
        const step = rows[0] ? rows[0].offsetHeight + 6 : 0
        try {
            if (next.kind === 'deal') {
                await Promise.all(
                    rows.map(
                        (li, i) =>
                            li.animate([{ transform: 'none', opacity: 1 }, { transform: `translateY(${(mid - i) * step}px) rotate(${(i - mid) * 2}deg) scale(0.96)`, opacity: 0.4 }], {
                                duration: 180,
                                easing: 'ease-in',
                                fill: 'forwards',
                            }).finished,
                    ),
                )
            } else if (next.kind === 'one') {
                const li = rows.find((r) => r.dataset.slot === String(next.slot))
                await li?.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateX(-24px)', opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' }).finished
            } else {
                await ul.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' }).finished
            }
        } catch {
            // Animación cancelada: se aplica igual.
        }
        change.current = next
        apply()
    }

    // Entrada de las filas nuevas (después de pintarlas, antes de que se vean).
    useLayoutEffect(() => {
        const ul = listRef.current
        const next = change.current
        change.current = null
        busy.current = false
        if (!ul || !next) return
        ul.getAnimations().forEach((a) => a.cancel())
        const rows = [...ul.children] as HTMLElement[]
        rows.forEach((li) => li.getAnimations().forEach((a) => a.cancel()))
        const mid = (rows.length - 1) / 2
        const step = rows[0] ? rows[0].offsetHeight + 6 : 0
        if (next.kind === 'deal') {
            rows.forEach((li, i) =>
                li.animate([{ transform: `translateY(${(mid - i) * step}px) rotate(${(i - mid) * 2}deg) scale(0.96)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }], {
                    duration: 280,
                    delay: i * 30,
                    easing: EASE,
                    fill: 'backwards',
                }),
            )
        } else if (next.kind === 'one') {
            rows.find((r) => r.dataset.slot === String(next.slot))?.animate([{ transform: 'translateX(24px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: EASE })
        } else {
            ul.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: EASE })
        }
    }, [shownKey, slots, session, mood, seed])

    function choose(next: () => void, kind: Change['kind'] = 'fade') {
        animate(kind === 'deal' ? { kind: 'deal' } : { kind: 'fade' }, () => {
            next()
            setSlots([0, 1, 2])
        })
    }

    /** Cambia una propuesta por la siguiente que no esté a la vista; al acabarse la lista, vuelve a las mejores. */
    function another(slot: number) {
        animate({ kind: 'one', slot }, () =>
            setSlots((current) => {
                const start = Math.max(...current) + 1
                for (let k = 0; k < list.length; k++) {
                    const next = (start + k) % list.length
                    if (!current.includes(next)) return current.map((s, i) => (i === slot ? next : s))
                }
                return current
            }),
        )
    }

    return (
        <section className="dash-panel wtp" id="dash-wtp" aria-labelledby="dash-wtp-title">
            <header className="dash-sec__head">
                <span className="dash-sec__icon hg-tint st-todos" aria-hidden>
                    <Dices />
                </span>
                <h2 id="dash-wtp-title" className="dash-sec__title">
                    ¿Qué juego hoy?
                </h2>
                <span className="dash-sec__count wtp__from">De tus Jugando y Pendientes</span>
                {list.length > SHOWN && (
                    <span className="dash-sec__end">
                        <Button type="button" variant="ghost" size="sm" onClick={() => choose(() => setSeed((s) => s + 1), 'deal')} title="Otras propuestas">
                            <Dices aria-hidden className="wtp__dice" /> Barajar
                        </Button>
                    </span>
                )}
            </header>
            <div className="wtp-choices">
                <Segmented label="Tiempo" value={session} options={SESSION_LABELS} onChange={(v) => choose(() => setSession(v))} />
                <Segmented label="Ganas" value={mood} options={MOOD_LABELS} onChange={(v) => choose(() => setMood(v), v === 'sorpresa' ? 'deal' : 'fade')} />
            </div>
            {visible.length === 0 ? (
                <p className="dash-empty dash-empty--plain">
                    {mood === 'nuevo'
                        ? 'No hay pendientes sin empezar. Pasa juegos a Pendientes desde la bandeja o la biblioteca.'
                        : mood === 'logros'
                          ? 'Ningún juego en Jugando o Pendientes tiene logros por desbloquear.'
                          : 'No hay juegos en Jugando ni en Pendientes que encajen.'}
                </p>
            ) : (
                <ul className="hg-rows" ref={listRef}>
                    {visible.map((index, slot) => {
                        const { game, reasons } = list[index]
                        const name = game.name ?? `App ${game.appid}`
                        const [why, ...more] = reasons.length ? reasons : ['Una buena opción para hoy']
                        return (
                            <li key={`${slot}-${game.appid}`} data-slot={slot} className={`hg-row lib-row dash-row--wtp st-${game.status}${game.owned ? '' : ' is-unowned'}`}>
                                <span className="hg-row__cover lib-cover">
                                    <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="header" sizes="112px" />
                                </span>
                                <span className="hg-row__main">
                                    <span className="lib-row__name">
                                        <Link href={`/juego/${game.appid}`} className="hg-row__link">
                                            {name}
                                        </Link>
                                        <MarkFlags favorite={game.favorite} endless={game.endless} />
                                        {!game.owned && (
                                            <span className="lib-own lib-own--no">
                                                <ShoppingCart aria-hidden /> Sin comprar
                                            </span>
                                        )}
                                    </span>
                                    <span className="hg-row__meta wtp__why">
                                        <span className="wtp__main-reason">{why}</span>
                                        {more.slice(0, 2).map((r) => (
                                            <span key={r}>{r}</span>
                                        ))}
                                    </span>
                                    <Facts game={game} />
                                    {!game.owned && <PriceTag game={game} />}
                                </span>
                                <span className="wtp-actions">
                                    <StatusChip status={game.status} />
                                    {game.owned ? (
                                        <Button asChild size="sm">
                                            <a href={steamRunUrl(game.appid)} aria-label={`Jugar a ${name}`}>
                                                <Play aria-hidden /> Jugar
                                            </a>
                                        </Button>
                                    ) : (
                                        <Button asChild size="sm">
                                            <a href={`https://store.steampowered.com/app/${game.appid}/`} target="_blank" rel="noreferrer" aria-label={`${name} en la tienda de Steam`}>
                                                <ExternalLink aria-hidden /> Ver en Steam
                                            </a>
                                        </Button>
                                    )}
                                    {list.length > visible.length && (
                                        <Button type="button" size="sm" variant="secondary" onClick={() => another(slot)}>
                                            <RefreshCw aria-hidden /> Otra
                                        </Button>
                                    )}
                                </span>
                            </li>
                        )
                    })}
                </ul>
            )}
        </section>
    )
}

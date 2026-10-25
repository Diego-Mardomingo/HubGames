'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Dices, Play, RefreshCw } from 'lucide-react'
import { MOOD_LABELS, SESSION_LABELS, recommend, type Mood, type SessionLength } from '@/lib/recommend'
import { steamRunUrl } from '@/lib/dashboard'
import type { LibraryGame } from '@/lib/tracker'
import { Button } from '@/components/ui/button'
import GameCover from '@/components/tracker/GameCover'

const SHOWN = 3

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Record<T, string>; onChange: (v: T) => void }) {
    return (
        <div className="wtp-choice" role="radiogroup" aria-label={label}>
            <span className="wtp-choice__label">{label}</span>
            <div className="wtp-choice__options">
                {(Object.keys(options) as T[]).map((key) => (
                    <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={value === key}
                        className={`wtp-chip ${value === key ? 'is-active' : ''}`}
                        onClick={() => onChange(key)}
                    >
                        {options[key]}
                    </button>
                ))}
            </div>
        </div>
    )
}

/**
 * "¿Qué juego hoy?" (#30): 3 propuestas de tus Jugando y Pendientes según el tiempo y las ganas.
 * `now` y `initialSeed` vienen del servidor para que el primer render coincida al hidratar.
 */
export default function WhatToPlay({ games, now, initialSeed }: { games: LibraryGame[]; now: number; initialSeed: number }) {
    const [session, setSession] = useState<SessionLength>('media')
    const [mood, setMood] = useState<Mood>('terminar')
    const [seed, setSeed] = useState(initialSeed)
    // Posición en la lista de propuestas que enseña cada hueco; "Otra" lo mueve a la siguiente que no esté a la vista.
    const [slots, setSlots] = useState<number[]>([0, 1, 2])

    const list = useMemo(() => recommend(games, session, mood, now, seed), [games, session, mood, now, seed])
    const visible = slots.filter((i) => i < list.length)

    function choose(next: () => void) {
        next()
        setSlots([0, 1, 2])
    }

    /** Cambia una propuesta por la siguiente que no esté a la vista; al acabarse la lista, vuelve a las mejores. */
    function another(slot: number) {
        setSlots((current) => {
            const start = Math.max(...current) + 1
            for (let k = 0; k < list.length; k++) {
                const next = (start + k) % list.length
                if (!current.includes(next)) return current.map((s, i) => (i === slot ? next : s))
            }
            return current
        })
    }

    return (
        <section className="dash-panel wtp" aria-labelledby="dash-wtp">
            <header className="dash-panel__head">
                <h2 id="dash-wtp" className="dash-panel__title">
                    ¿Qué juego hoy?
                </h2>
                {list.length > SHOWN && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => choose(() => setSeed((s) => s + 1))} title="Otras propuestas">
                        <Dices aria-hidden /> Barajar
                    </Button>
                )}
            </header>
            <div className="wtp-choices">
                <Segmented label="Tiempo" value={session} options={SESSION_LABELS} onChange={(v) => choose(() => setSession(v))} />
                <Segmented label="Ganas" value={mood} options={MOOD_LABELS} onChange={(v) => choose(() => setMood(v))} />
            </div>
            {visible.length === 0 ? (
                <p className="dash-empty">
                    {mood === 'nuevo'
                        ? 'No hay pendientes sin empezar. Pasa juegos a Pendientes desde la bandeja o la biblioteca.'
                        : mood === 'logros'
                          ? 'Ningún juego en Jugando o Pendientes tiene logros por desbloquear.'
                          : 'No hay juegos en Jugando ni en Pendientes que encajen.'}
                </p>
            ) : (
                <ul className="dash-rows">
                    {visible.map((index, slot) => {
                        const { game, reasons } = list[index]
                        return (
                            <li key={`${slot}-${game.appid}`} className="dash-row dash-row--wtp">
                                <span className="dash-row__cover">
                                    <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="header" sizes="112px" />
                                </span>
                                <span className="dash-row__main">
                                    <Link href={`/juego/${game.appid}`} className="dash-row__link">
                                        {game.name ?? `App ${game.appid}`}
                                    </Link>
                                    <span className="dash-row__meta">
                                        {(reasons.length ? reasons : ['Una buena opción para hoy']).slice(0, 3).join(' · ')}
                                    </span>
                                </span>
                                <span className="wtp-actions">
                                    <Button asChild size="sm">
                                        <a href={steamRunUrl(game.appid)}>
                                            <Play aria-hidden /> Jugar
                                        </a>
                                    </Button>
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

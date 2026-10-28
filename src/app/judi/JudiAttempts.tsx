'use client'

import { Check, Lock, SkipForward, X, type LucideIcon } from 'lucide-react'
import type { JudiSlot, JudiSlotKind } from '@/lib/judi'

/** Icono de cada intento hecho: nunca solo color. */
const SLOT_ICON: Partial<Record<JudiSlotKind, LucideIcon>> = { miss: X, skip: SkipForward, hit: Check }

const SLOT_WORD: Record<JudiSlotKind, string> = {
    miss: 'fallado',
    skip: 'saltado',
    hit: 'acertado',
    current: 'en curso',
    open: 'sin usar',
    locked: 'bloqueado',
}

/** Lo que acaba de pasar, para animar ese intento: `n` cambia en cada envío para que la animación vuelva a empezar. */
export type JudiFx = { kind: 'miss' | 'skip' | 'win' | 'lost'; slot: number; n: number }

function fxClass(fx: JudiFx | null, i: number) {
    if (!fx || fx.slot !== i) return ''
    return fx.kind === 'win' ? ' jd-fx-hit' : ' jd-fx-lose'
}

/** Los 6 intentos como cuadraditos con su icono (fallo rojo, saltado neutro, acierto verde, el actual con borde cobalto). */
export function AttemptPips({ slots, size = 'md', fx = null }: { slots: JudiSlot[]; size?: 'sm' | 'md'; fx?: JudiFx | null }) {
    const misses = slots.filter((s) => s.kind === 'miss').length
    const skips = slots.filter((s) => s.kind === 'skip').length
    const label = `${misses} ${misses === 1 ? 'fallado' : 'fallados'}${skips ? ` y ${skips} ${skips === 1 ? 'saltado' : 'saltados'}` : ''} de 6 intentos`
    return (
        <span className={`jd-pips jd-pips--${size}`} role="img" aria-label={label}>
            {slots.map((s, i) => {
                const Icon = SLOT_ICON[s.kind]
                return (
                    <span key={fx?.slot === i ? `${i}-${fx.n}` : i} className={`jd-pip jd-pip--${s.kind}${fxClass(fx, i)}`}>
                        {Icon && <Icon aria-hidden strokeWidth={3} />}
                    </span>
                )
            })}
        </span>
    )
}

/**
 * Tira de capturas: una por intento, con su número, el icono y la franja del resultado de ese intento. Las que aún no
 * has abierto, con candado. Pulsar una la enseña en grande.
 */
export function JudiStrip({
    slots,
    viewed,
    captureUrl,
    onView,
    fx,
    unlocked,
}: {
    slots: JudiSlot[]
    viewed: number
    captureUrl: (phase: number) => string | undefined
    onView: (phase: number) => void
    fx: JudiFx | null
    /** Fase recién abierta (aparece con un fundido). */
    unlocked: number | null
}) {
    return (
        <div className="jd-strip" role="tablist" aria-label="Capturas e intentos">
            {slots.map((s, i) => {
                const phase = i + 1
                if (s.kind === 'locked') {
                    return (
                        <button key={phase} type="button" role="tab" className="jd-shot jd-shot--locked" disabled aria-label={`Captura ${phase}, bloqueada`}>
                            <Lock aria-hidden />
                            <span>Fase {phase}</span>
                        </button>
                    )
                }
                const Icon = SLOT_ICON[s.kind]
                const src = captureUrl(phase)
                return (
                    <button
                        key={fx?.slot === i ? `${phase}-${fx.n}` : phase}
                        type="button"
                        role="tab"
                        aria-selected={viewed === phase}
                        className={`jd-shot jd-shot--${s.kind}${fxClass(fx, i)}${unlocked === phase ? ' is-unlock' : ''}`}
                        onClick={() => onView(phase)}
                        aria-label={`Captura ${phase}, ${SLOT_WORD[s.kind]}${s.name ? `: ${s.name}` : ''}`}
                    >
                        {src && (
                            <img
                                src={src}
                                alt=""
                                loading="lazy"
                                draggable={false}
                                onError={(e) => {
                                    e.currentTarget.style.visibility = 'hidden'
                                }}
                            />
                        )}
                        <span className="jd-shot__tag">
                            {Icon && <Icon aria-hidden strokeWidth={3} />}
                            {phase}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}

'use client'

import { Building2, CalendarDays, Lock, Tags, ThumbsUp, Users, type LucideIcon } from 'lucide-react'
import type { JudiHints as Hints } from '@/lib/judi'
import { steamReviewScore } from '@/lib/scores'

type Hint = { phase: number; label: string; icon: LucideIcon; value: (h: Hints) => string | null }

/** Una pista por fase a partir de la 2 (las que manda el servidor). */
export const JUDI_HINTS: Hint[] = [
    { phase: 2, label: 'Géneros', icon: Tags, value: (h) => h.generos ?? null },
    { phase: 3, label: 'Pico de jugadores (Steam)', icon: Users, value: (h) => (h.ccu != null ? h.ccu.toLocaleString('es-ES') : null) },
    { phase: 4, label: 'Reseñas positivas (Steam)', icon: ThumbsUp, value: (h) => (h.positivas != null ? `${h.positivas} %` : null) },
    { phase: 5, label: 'Año de lanzamiento', icon: CalendarDays, value: (h) => h.anio ?? null },
    { phase: 6, label: 'Estudio', icon: Building2, value: (h) => h.estudio ?? null },
]

/** Pista de una fase (para la placa sobre la captura). */
export function hintFor(hints: Hints, phase: number): { label: string; value: string } | null {
    const hint = JUDI_HINTS.find((h) => h.phase === phase)
    return hint ? { label: hint.label, value: hint.value(hints) ?? 'N/D' } : null
}

/**
 * Lista de pistas. Color solo donde el dato tiene escala propia: las reseñas, con la de Steam (`steamReviewScore`), como
 * en la ficha. La última abierta mientras juegas va en cobalto con «Nueva»; la recién abierta se despliega.
 */
export default function JudiHints({
    hints,
    unlockedPhase,
    viewed,
    playing,
    fresh,
    onView,
}: {
    hints: Hints
    unlockedPhase: number
    viewed: number
    playing: boolean
    /** Fase que se acaba de abrir (se anima). */
    fresh: number | null
    onView: (phase: number) => void
}) {
    const newest = playing && unlockedPhase >= 2 ? unlockedPhase : 0
    return (
        <div className="jd-hints">
            <h2 className="jd-panel__title">
                Pistas <span className="jd-panel__count">{Math.max(0, unlockedPhase - 1)} de 5</span>
            </h2>
            <ul className="jd-hints__list">
                {JUDI_HINTS.map((hint) => {
                    const open = hint.phase <= unlockedPhase
                    const isNew = open && hint.phase === newest
                    const Icon = open ? hint.icon : Lock
                    const raw = open ? hint.value(hints) : null
                    const review = open && hint.phase === 4 && hints.positivas != null ? steamReviewScore(hints.positivas) : null
                    return (
                        <li key={hint.phase}>
                            <button
                                type="button"
                                className={`jd-hint${open ? '' : ' is-locked'}${viewed === hint.phase ? ' is-active' : ''}${isNew ? ' is-new' : ''}${fresh === hint.phase ? ' jd-fx-unlock' : ''}`}
                                disabled={!open}
                                aria-pressed={open ? viewed === hint.phase : undefined}
                                onClick={() => onView(hint.phase)}
                            >
                                <span className="jd-hint__icon">
                                    <Icon aria-hidden />
                                </span>
                                <span className="jd-hint__text">
                                    <span className="jd-hint__label">{hint.label}</span>
                                    <span className="jd-hint__value">
                                        {!open ? (
                                            `Se abre en la fase ${hint.phase}`
                                        ) : review ? (
                                            <>
                                                <span className={`hg-score hg-tint sc-${review.tier}`}>{hints.positivas} %</span>
                                                <small className={`jd-hint__word sc-${review.tier}`}>{review.label}</small>
                                            </>
                                        ) : (
                                            (raw ?? 'N/D')
                                        )}
                                    </span>
                                </span>
                                <span className="jd-hint__end">
                                    {isNew && <span className="jd-new hg-tint st-todos">Nueva</span>}
                                    <span className="jd-hint__phase">Fase {hint.phase}</span>
                                </span>
                            </button>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

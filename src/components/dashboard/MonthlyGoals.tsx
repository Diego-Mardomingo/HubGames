'use client'

import { useState } from 'react'
import { Check, Minus, Pencil, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { GOAL_KINDS, GOAL_LABELS, GOAL_MAX, goalPace, monthName, type GoalKind, type GoalPace } from '@/lib/goals'
import { Button } from '@/components/ui/button'

type Targets = Record<GoalKind, number>

interface Props {
    userId: string
    month: string
    /** Las guardadas; vacío = aún no has aceptado ninguna este mes. */
    saved: Partial<Targets>
    suggested: Targets
    progress: Targets
    /** Fracción del mes que ha pasado. */
    elapsed: number
}

const PACE_LABELS: Record<GoalPace, string> = { cumplida: '¡Cumplida!', al_dia: 'Vas al día', por_detras: 'Vas por detrás' }

/** Paso del +/−: los logros van de 5 en 5. */
const STEP: Record<GoalKind, number> = { completar: 1, logros: 5, perfectos: 1 }

function label(kind: GoalKind, n: number) {
    return n === 1 ? GOAL_LABELS[kind].one : GOAL_LABELS[kind].many
}

/** Metas mensuales (#31): se proponen a partir de tu media; las aceptas o las ajustas, y el progreso se mide solo. */
export default function MonthlyGoals({ userId, month, saved, suggested, progress, elapsed }: Props) {
    const hasSaved = GOAL_KINDS.every((k) => saved[k] !== undefined)
    const [targets, setTargets] = useState<Targets | null>(hasSaved ? (saved as Targets) : null)
    const [draft, setDraft] = useState<Targets | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    async function save(values: Targets) {
        setBusy(true)
        setError('')
        const { error } = await supabase
            .from('hubgames_monthly_goals')
            .upsert(GOAL_KINDS.map((kind) => ({ user_id: userId, month, kind, target: values[kind] })), { onConflict: 'user_id,month,kind' })
        setBusy(false)
        if (error) {
            setError(`No se pudieron guardar: ${error.message}`)
            return
        }
        setTargets(values)
        setDraft(null)
    }

    const shown = draft ?? targets ?? suggested
    const title = `Metas de ${monthName(month)}`

    return (
        <section className="dash-panel goals" aria-labelledby="dash-goals">
            <header className="dash-panel__head">
                <h2 id="dash-goals" className="dash-panel__title">
                    {title}
                </h2>
                {targets && !draft && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(targets)}>
                        <Pencil aria-hidden /> Ajustar
                    </Button>
                )}
            </header>
            {!targets && !draft && <p className="dash-empty">Propuesta según tu media de los últimos meses:</p>}
            <ul className="goals__list">
                {GOAL_KINDS.map((kind) => {
                    const target = shown[kind]
                    const done = progress[kind]
                    const pct = Math.min(100, Math.round((done / target) * 100))
                    const pace = goalPace(done, target, elapsed)
                    return (
                        <li key={kind} className="goal">
                            <div className="goal__row">
                                {draft ? (
                                    <span className="goal__stepper" role="group" aria-label={GOAL_LABELS[kind].many}>
                                        <button
                                            type="button"
                                            aria-label="Menos"
                                            disabled={target <= STEP[kind]}
                                            onClick={() => setDraft({ ...draft, [kind]: Math.max(STEP[kind], target - STEP[kind]) })}
                                        >
                                            <Minus size={13} />
                                        </button>
                                        <strong>{target}</strong>
                                        <button
                                            type="button"
                                            aria-label="Más"
                                            disabled={target >= GOAL_MAX[kind]}
                                            onClick={() => setDraft({ ...draft, [kind]: Math.min(GOAL_MAX[kind], target + STEP[kind]) })}
                                        >
                                            <Plus size={13} />
                                        </button>
                                        <span>{label(kind, target)}</span>
                                    </span>
                                ) : (
                                    <span className="goal__name">
                                        <strong>
                                            {done}/{target}
                                        </strong>{' '}
                                        {label(kind, target)}
                                    </span>
                                )}
                                {targets && !draft && <span className={`goal__pace goal__pace--${pace}`}>{PACE_LABELS[pace]}</span>}
                            </div>
                            <span className={`hg-bar${pace === 'cumplida' ? ' is-done' : ''}`} aria-hidden>
                                <span style={{ width: `${pct}%` }} />
                            </span>
                        </li>
                    )
                })}
            </ul>
            {error && (
                <p className="alert alert--error" role="alert">
                    {error}
                </p>
            )}
            {draft ? (
                <div className="goals__actions">
                    <Button type="button" size="sm" disabled={busy} onClick={() => save(draft)}>
                        <Check aria-hidden /> Guardar
                    </Button>
                    <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setDraft(null)}>
                        Cancelar
                    </Button>
                </div>
            ) : (
                !targets && (
                    <div className="goals__actions">
                        <Button type="button" size="sm" disabled={busy} onClick={() => save(suggested)}>
                            <Check aria-hidden /> Aceptar
                        </Button>
                        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setDraft(suggested)}>
                            <Pencil aria-hidden /> Ajustar
                        </Button>
                    </div>
                )
            )}
        </section>
    )
}

'use client'

import { useState } from 'react'
import { AlertTriangle, Check, Clock, Flag, Minus, Pencil, Plus, Target, Trophy } from 'lucide-react'
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
    /** Día de hoy y días del mes, para la marca de «hoy» en las barras. */
    today: { day: number; days: number }
}

const PACE_LABELS: Record<GoalPace, string> = { cumplida: '¡Cumplida!', al_dia: 'Vas al día', por_detras: 'Vas por detrás' }

/** Color e icono del ritmo: cumplida en verde, al día en el acento, por detrás en ámbar (barra y chip). */
const PACE_TONE: Record<GoalPace, string> = { cumplida: 'dash-ok', al_dia: 'st-todos', por_detras: 'dash-warn' }
const PACE_ICON: Record<GoalPace, React.ReactNode> = { cumplida: <Check aria-hidden />, al_dia: <Clock aria-hidden />, por_detras: <AlertTriangle aria-hidden /> }

/** Icono y color de cada meta: terminar (Completado), logros (como en la ficha) y al 100 %. */
const KIND_ICON: Record<GoalKind, { icon: React.ReactNode; tone: string }> = {
    completar: { icon: <Flag aria-hidden />, tone: 'st-completado' },
    logros: { icon: <Trophy aria-hidden />, tone: 'st-sin_final' },
    perfectos: { icon: <Target aria-hidden />, tone: 'st-completado' },
}

/** Paso del +/−: los logros van de 5 en 5. */
const STEP: Record<GoalKind, number> = { completar: 1, logros: 5, perfectos: 1 }

function label(kind: GoalKind, n: number) {
    return n === 1 ? GOAL_LABELS[kind].one : GOAL_LABELS[kind].many
}

/** Metas mensuales (#31): se proponen a partir de tu media; las aceptas o las ajustas, y el progreso se mide solo. */
export default function MonthlyGoals({ userId, month, saved, suggested, progress, elapsed, today }: Props) {
    const hasSaved = GOAL_KINDS.every((k) => saved[k] !== undefined)
    const [targets, setTargets] = useState<Targets | null>(hasSaved ? (saved as Targets) : null)
    const [draft, setDraft] = useState<Targets | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    // Tras guardar, los iconos de los chips de ritmo se dibujan.
    const [justSaved, setJustSaved] = useState(false)

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
        setJustSaved(true)
    }

    const shown = draft ?? targets ?? suggested
    const title = `Metas de ${monthName(month)}`

    return (
        <section className="dash-panel goals" aria-labelledby="dash-goals">
            <header className="dash-sec__head">
                <span className="dash-sec__icon hg-tint st-todos" aria-hidden>
                    <Target />
                </span>
                <h2 id="dash-goals" className="dash-sec__title">
                    {title}
                </h2>
                {targets && !draft && (
                    <span className="dash-sec__end">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(targets)}>
                            <Pencil aria-hidden /> Ajustar
                        </Button>
                    </span>
                )}
            </header>
            {!targets && !draft && <p className="dash-note">Propuesta según tu media de los últimos meses:</p>}
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
                                        <span className={`goal__icon hg-tint ${KIND_ICON[kind].tone}`}>{KIND_ICON[kind].icon}</span>
                                        <span>
                                            <strong>
                                                {done}/{target}
                                            </strong>{' '}
                                            {label(kind, target)}
                                        </span>
                                    </span>
                                )}
                                {targets && !draft && (
                                    <span className={`dash-pill dash-pill--sm hg-tint ${PACE_TONE[pace]}${justSaved ? ' hg-draw' : ''}`}>
                                        {PACE_ICON[pace]}
                                        {PACE_LABELS[pace]}
                                    </span>
                                )}
                            </div>
                            <span className={`goal__track ${targets && !draft ? PACE_TONE[pace] : 'st-todos'}`}>
                                <span className="hg-bar hg-bar--fill goal__bar" style={{ '--i': GOAL_KINDS.indexOf(kind) } as React.CSSProperties} aria-hidden>
                                    <span style={{ width: `${pct}%` }} />
                                </span>
                                {targets && !draft && <span className="goal__today" style={{ left: `${Math.min(100, elapsed * 100)}%` }} aria-hidden />}
                            </span>
                        </li>
                    )
                })}
            </ul>
            {targets && !draft && (
                <p className="goals__foot">
                    <span className="goals__mark">
                        <i aria-hidden />
                        Hoy, día {today.day} de {today.days}
                    </span>
                    <span>{today.days - today.day === 0 ? 'Último día' : today.days - today.day === 1 ? 'Queda 1 día' : `Quedan ${today.days - today.day} días`}</span>
                </p>
            )}
            {error && (
                <p className="alert alert--error" role="alert">
                    {error}
                </p>
            )}
            {draft ? (
                <div className="goals__actions">
                    <Button type="button" size="sm" loading={busy} onClick={() => save(draft)}>
                        <Check aria-hidden /> Guardar
                    </Button>
                    <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setDraft(null)}>
                        Cancelar
                    </Button>
                </div>
            ) : (
                !targets && (
                    <div className="goals__actions">
                        <Button type="button" size="sm" loading={busy} onClick={() => save(suggested)}>
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

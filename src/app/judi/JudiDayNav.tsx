'use client'

import { Check, ChevronLeft, ChevronRight, CircleDashed, Play, X } from 'lucide-react'
import type { JudiDayStatus } from '@/lib/judi'

/** Un día al que se puede saltar: su número, su fecha (AAAA-MM-DD) y cómo lo tienes. */
export type JudiDayNavTarget = { id: number; date: string; status: JudiDayStatus }

const STATUS_LABEL: Record<JudiDayStatus, string> = {
    won: 'acertado',
    lost: 'fallado',
    progress: 'en curso',
    new: 'sin jugar',
}

/** Los mismos iconos que el filtro del historial (`JudiHistory`). */
function StatusIcon({ status }: { status: JudiDayStatus }) {
    const icon =
        status === 'won' ? <Check strokeWidth={3} /> : status === 'lost' ? <X strokeWidth={3} /> : status === 'progress' ? <Play strokeWidth={2.5} /> : <CircleDashed strokeWidth={2.5} />
    return (
        <span className={`jd-daynav__st is-${status}`} aria-hidden>
            {icon}
        </span>
    )
}

function localDate(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d)
}

const shortDate = (iso: string) => localDate(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
const longDate = (iso: string) => localDate(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })

function DayButton({ dir, target, disabled, onGo }: { dir: -1 | 1; target: JudiDayNavTarget | null; disabled: boolean; onGo: (dir: -1 | 1) => void }) {
    const name = dir < 0 ? 'Día anterior' : 'Día siguiente'
    const Chevron = dir < 0 ? ChevronLeft : ChevronRight
    if (!target) {
        return (
            <button type="button" className="jd-daynav__btn" data-dir={dir} disabled aria-label={`${name}: no hay, ${dir < 0 ? 'es el primer JUDI' : 'es el JUDI de hoy'}`}>
                {dir < 0 && <Chevron aria-hidden />}
                <span className="jd-daynav__lbl">{name}</span>
                {dir > 0 && <Chevron aria-hidden />}
            </button>
        )
    }
    const label = (
        <span className="jd-daynav__lbl">
            #{target.id} <span className="jd-daynav__date">· {shortDate(target.date)}</span>
        </span>
    )
    return (
        <button
            type="button"
            className="jd-daynav__btn"
            data-dir={dir}
            data-tip={`${name} · Shift + ${dir < 0 ? '←' : '→'}`}
            disabled={disabled}
            aria-label={`${name}: JUDI #${target.id}, ${longDate(target.date)}, ${STATUS_LABEL[target.status]}`}
            aria-keyshortcuts={dir < 0 ? 'Shift+ArrowLeft' : 'Shift+ArrowRight'}
            onClick={() => onGo(dir)}
        >
            {dir < 0 ? (
                <>
                    <Chevron aria-hidden />
                    <StatusIcon status={target.status} />
                    {label}
                </>
            ) : (
                <>
                    {label}
                    <StatusIcon status={target.status} />
                    <Chevron aria-hidden />
                </>
            )}
        </button>
    )
}

/**
 * «Día anterior / Día siguiente» dentro de la partida (#139): recorre todos los días publicados por fecha, jugados o
 * no. En el primero no hay anterior y en el de hoy no hay siguiente. Atajo: Shift + ← / → (lo pone `JudiClient`).
 */
export default function JudiDayNav({
    prev,
    next,
    disabled = false,
    onGo,
}: {
    prev: JudiDayNavTarget | null
    next: JudiDayNavTarget | null
    /** Mientras se comprueba un intento: el resultado tiene que caer en la partida de la que salió. */
    disabled?: boolean
    onGo: (dir: -1 | 1) => void
}) {
    return (
        <nav className="jd-daynav" aria-label="Cambiar de día">
            <DayButton dir={-1} target={prev} disabled={disabled} onGo={onGo} />
            <DayButton dir={1} target={next} disabled={disabled} onGo={onGo} />
        </nav>
    )
}

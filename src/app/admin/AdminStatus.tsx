import { Check, Clock, Loader2, Minus, TriangleAlert, X } from 'lucide-react'
import { RUN_STATE_META, type RunState } from '@/lib/admin'

const ICONS = { ok: Check, ko: X, partial: TriangleAlert, run: Loader2, stale: Clock, same: Minus } as const

/** Chip de estado de un log o una sincronización: icono y palabra sobre el tinte de su color. «En curso» gira (`.hg-spin`). */
export default function AdminStatus({ state }: { state: RunState }) {
    const { tone, label } = RUN_STATE_META[state]
    const Icon = ICONS[state]
    return (
        <span className={`hg-chip hg-tint ad-status ${tone}`}>
            <Icon className={state === 'run' ? 'hg-spin' : undefined} aria-hidden />
            {label}
        </span>
    )
}

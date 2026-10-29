import { Bookmark, CircleX, EyeOff, Flag, Heart, History, Inbox, Infinity as InfinityIcon, Pause, Play, Repeat, Shapes, type LucideIcon } from 'lucide-react'
import { STATUS_LABELS, type GameStatus } from '@/lib/tracker'
import type { LibraryTab } from '@/lib/library'
import '@/styles/lists.css'

/** Icono de cada lista. El color va en la clase `st-<lista>` (styles/lists.css), el mismo en todas partes. */
export const LIST_ICONS: Record<GameStatus | 'favorito' | 'sin_final', LucideIcon> = {
    bandeja: Inbox,
    pendiente: Bookmark,
    jugando: Play,
    pausado: Pause,
    rejugable: Repeat,
    completado: Flag,
    abandonado: CircleX,
    ya_jugado: History,
    descartado: EyeOff,
    otros: Shapes,
    favorito: Heart,
    sin_final: InfinityIcon,
}

/** Clase de color de una lista (`st-jugando`...). "Todos" usa el acento. */
export function listClass(list: LibraryTab): string {
    return `st-${list}`
}

/**
 * Chip de estado con icono y el color de su lista. `changed`: acaba de cambiar (el color pasa con una transición y el
 * icono hace pop; en Completado, la bandera se planta).
 */
export function StatusChip({ status, changed }: { status: GameStatus; changed?: boolean }) {
    const Icon = LIST_ICONS[status]
    const motion = changed ? (status === 'completado' ? ' is-plant' : ' is-in') : ''
    return (
        <span className={`hg-chip hg-tint st-${status}`}>
            <span key={status} className={`hg-chip__icon${motion}`}>
                <Icon aria-hidden />
            </span>{' '}
            {STATUS_LABELS[status]}
        </span>
    )
}

type Mark = 'favorite' | 'endless'

/**
 * Marcas del juego (favorito, sin final) como iconos pequeños junto al nombre. `lit`: la que se acaba de marcar (pop; el
 * corazón late y el ∞ se traza). `leaving`: la que se acaba de quitar (se encoge y se va; se sigue pintando mientras).
 */
export function MarkFlags({ favorite, endless, lit, leaving }: { favorite: boolean; endless: boolean; lit?: Mark | null; leaving?: Mark | null }) {
    const fav = favorite || leaving === 'favorite'
    const inf = endless || leaving === 'endless'
    if (!fav && !inf) return null
    const cls = (m: Mark) => (leaving === m ? ' is-out' : lit === m ? ' is-in' : '')
    return (
        <>
            {fav && (
                <span className={`hg-flag hg-tint st-favorito${cls('favorite')}`} title="Favorito" aria-hidden={!favorite || undefined}>
                    <Heart aria-hidden />
                    <span className="sr-only">Favorito</span>
                </span>
            )}
            {inf && (
                <span className={`hg-flag hg-tint st-sin_final${cls('endless')}`} title="Sin final" aria-hidden={!endless || undefined}>
                    <InfinityIcon aria-hidden className={lit === 'endless' ? 'hg-loop' : undefined} />
                    <span className="sr-only">Sin final</span>
                </span>
            )}
        </>
    )
}

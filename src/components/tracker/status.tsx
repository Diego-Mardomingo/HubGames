import { Bookmark, CircleX, EyeOff, Flag, Heart, Inbox, Infinity as InfinityIcon, Pause, Play, type LucideIcon } from 'lucide-react'
import { STATUS_LABELS, type GameStatus } from '@/lib/tracker'
import type { LibraryTab } from '@/lib/library'
import '@/styles/lists.css'

/** Icono de cada lista. El color va en la clase `st-<lista>` (styles/lists.css), el mismo en todas partes. */
export const LIST_ICONS: Record<GameStatus | 'favorito' | 'sin_final', LucideIcon> = {
    bandeja: Inbox,
    pendiente: Bookmark,
    jugando: Play,
    pausado: Pause,
    completado: Flag,
    abandonado: CircleX,
    descartado: EyeOff,
    favorito: Heart,
    sin_final: InfinityIcon,
}

/** Clase de color de una lista (`st-jugando`...). "Todos" usa el acento. */
export function listClass(list: LibraryTab): string {
    return `st-${list}`
}

/** Chip de estado con icono y el color de su lista. */
export function StatusChip({ status }: { status: GameStatus }) {
    const Icon = LIST_ICONS[status]
    return (
        <span className={`hg-chip hg-tint st-${status}`}>
            <Icon aria-hidden /> {STATUS_LABELS[status]}
        </span>
    )
}

/** Marcas del juego (favorito, sin final) como iconos pequeños junto al nombre. */
export function MarkFlags({ favorite, endless }: { favorite: boolean; endless: boolean }) {
    if (!favorite && !endless) return null
    return (
        <>
            {favorite && (
                <span className="hg-flag hg-tint st-favorito" title="Favorito">
                    <Heart aria-hidden />
                    <span className="sr-only">Favorito</span>
                </span>
            )}
            {endless && (
                <span className="hg-flag hg-tint st-sin_final" title="Sin final">
                    <InfinityIcon aria-hidden />
                    <span className="sr-only">Sin final</span>
                </span>
            )}
        </>
    )
}

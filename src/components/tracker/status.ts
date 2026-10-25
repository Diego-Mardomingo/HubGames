import type { GameStatus } from '@/lib/tracker'

/** Chip de estado (styles/lists.css): el acento para "Jugando", verde para "Completado" y neutro para el resto. */
export function statusChipClass(status: GameStatus): string {
    return `hg-chip${status === 'jugando' ? ' hg-chip--playing' : status === 'completado' ? ' hg-chip--done' : ''}`
}

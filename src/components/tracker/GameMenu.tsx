'use client'

import { useState } from 'react'
import { BookmarkX, Check, MoreHorizontal } from 'lucide-react'
import {
    GAME_STATUSES,
    STATUS_LABELS,
    completeGames,
    removeFromPending,
    setGameMark,
    setGamesStatus,
    suggestedCompletionDate,
    type GameMark,
    type GameStatus,
    type LibraryGame,
} from '@/lib/tracker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Spinner } from '@/components/ui/spinner'
import { LIST_ICONS } from './status'
import './tracker.css'

interface Props {
    game: LibraryGame
    /** Cambios ya guardados, para actualizar la lista sin recargar. `null` = el juego ha salido de tu biblioteca. */
    onChange: (patch: Partial<LibraryGame> | null) => void
    onError: (message: string) => void
}

const MARKS: { mark: GameMark; list: 'favorito' | 'sin_final'; label: string }[] = [
    { mark: 'favorite', list: 'favorito', label: 'Favorito' },
    { mark: 'endless', list: 'sin_final', label: 'Sin final' },
]

/**
 * Menú de una fila de la biblioteca: estado (con el color de cada lista) y marcas, sin abrir la ficha. "Completado"
 * usa la fecha sugerida (último logro o última partida); la nota se pone luego en la ficha. Los pendientes sin comprar
 * solo pueden marcarse o quitarse de Pendientes.
 */
export default function GameMenu({ game, onChange, onError }: Props) {
    const [open, setOpen] = useState(false)
    /** Opción guardándose ("status:jugando", "mark:favorite", "quitar"): enseña el spinner y el resto espera. */
    const [pending, setPending] = useState<string | null>(null)
    const busy = pending !== null
    const name = game.name ?? `App ${game.appid}`

    async function run(key: string, action: () => Promise<void>, patch: Partial<LibraryGame> | null, close = true) {
        setPending(key)
        try {
            await action()
            onChange(patch)
            if (close) setOpen(false)
        } catch (e) {
            onError(e instanceof Error ? e.message : 'No se pudo guardar')
        } finally {
            setPending(null)
        }
    }

    function changeStatus(status: GameStatus) {
        if (status === game.status) return
        const now = new Date().toISOString()
        if (status === 'completado') {
            run(`status:${status}`, () => completeGames([game]), { status, status_source: 'manual', suggestion: null, completed_at: suggestedCompletionDate(game)?.date ?? now })
            return
        }
        run(`status:${status}`, () => setGamesStatus([game.appid], status), {
            status,
            status_source: 'manual',
            suggestion: null,
            status_changed_at: now,
            ...(status === 'jugando' && !game.started_at && { started_at: now }),
        })
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button type="button" className="hg-icon-btn game-menu__trigger" aria-label={`Cambiar estado o marcas de ${name}`}>
                    <MoreHorizontal aria-hidden />
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="game-menu" aria-label={`Lista de ${name}`}>
                {game.owned && (
                    <div className="game-menu__group" role="group" aria-label="Estado">
                        {GAME_STATUSES.map((s) => {
                            const Icon = LIST_ICONS[s]
                            const current = s === game.status
                            return (
                                <button
                                    key={s}
                                    type="button"
                                    className={`game-menu__opt st-${s}`}
                                    aria-pressed={current}
                                    aria-busy={pending === `status:${s}` || undefined}
                                    disabled={busy}
                                    onClick={() => changeStatus(s)}
                                >
                                    {pending === `status:${s}` ? <Spinner className="game-menu__icon" /> : <Icon className="game-menu__icon" aria-hidden />}{' '}
                                    {STATUS_LABELS[s]}
                                    {current && <Check className="game-menu__check" aria-hidden />}
                                </button>
                            )
                        })}
                    </div>
                )}
                <div className="game-menu__group" role="group" aria-label="Marcas">
                    {MARKS.map(({ mark, list, label }) => {
                        const Icon = LIST_ICONS[list]
                        const on = game[mark]
                        return (
                            <button
                                key={mark}
                                type="button"
                                className={`game-menu__opt st-${list}`}
                                aria-pressed={on}
                                aria-busy={pending === `mark:${mark}` || undefined}
                                disabled={busy}
                                onClick={() => run(`mark:${mark}`, () => setGameMark(game.appid, mark, !on), { [mark]: !on }, false)}
                            >
                                {pending === `mark:${mark}` ? <Spinner className="game-menu__icon" /> : <Icon className="game-menu__icon" aria-hidden />} {label}
                                {on && <Check className="game-menu__check" aria-hidden />}
                            </button>
                        )
                    })}
                </div>
                {!game.owned && (
                    <div className="game-menu__group">
                        <button
                            type="button"
                            className="game-menu__opt"
                            aria-busy={pending === 'quitar' || undefined}
                            disabled={busy}
                            onClick={() => run('quitar', () => removeFromPending(game.appid), null)}
                        >
                            {pending === 'quitar' ? <Spinner className="game-menu__icon" /> : <BookmarkX className="game-menu__icon" aria-hidden />} Quitar de Pendientes
                        </button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}

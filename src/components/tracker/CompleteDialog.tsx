'use client'

import { useState, type KeyboardEvent } from 'react'
import { Flag, Star } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { saveCompletion, suggestedCompletionDate, type Completion, type LibraryGame } from '@/lib/tracker'
import './tracker.css'

export type CompletableGame = Pick<
    LibraryGame,
    'appid' | 'name' | 'rating' | 'completed_at' | 'review' | 'last_unlock_at' | 'rtime_last_played'
>

interface Props {
    game: CompletableGame | null
    onOpenChange: (open: boolean) => void
    onSaved: (appid: number, completion: Completion) => void
}

/** yyyy-mm-dd en la zona horaria del navegador. */
function toDateInput(iso: string): string {
    return new Date(iso).toLocaleDateString('sv-SE')
}

const SHORT_DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * Diálogo de completar (#19): nota de 0 a 10 en pasos de 0,5, fecha sugerida y reseña opcional.
 * Si el juego ya estaba completado, abre con sus datos para editarlos.
 */
export default function CompleteDialog({ game, onOpenChange, onSaved }: Props) {
    return (
        <Dialog open={game !== null} onOpenChange={onOpenChange}>
            <DialogContent className="complete-dialog" aria-describedby={undefined}>
                {/* key: el formulario se reinicia con los datos de cada juego */}
                {game && <CompleteForm key={game.appid} game={game} onSaved={onSaved} onCancel={() => onOpenChange(false)} />}
            </DialogContent>
        </Dialog>
    )
}

function CompleteForm({
    game,
    onSaved,
    onCancel,
}: {
    game: CompletableGame
    onSaved: Props['onSaved']
    onCancel: () => void
}) {
    const suggestion = suggestedCompletionDate(game)
    const [rating, setRating] = useState<number | null>(game.rating)
    const [date, setDate] = useState(toDateInput(game.completed_at ?? suggestion?.date ?? new Date().toISOString()))
    const [review, setReview] = useState(game.review ?? '')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    /** Con el slider enfocado, una cifra pone esa nota (0 a 9) y "+" / "-" suman o restan medio punto. */
    function onRatingKey(e: KeyboardEvent<HTMLInputElement>) {
        if (/^[0-9]$/.test(e.key)) {
            e.preventDefault()
            setRating(Number(e.key))
        } else if (e.key === 'Enter') {
            // Un range no envía el formulario con Intro por sí solo.
            e.preventDefault()
            e.currentTarget.form?.requestSubmit()
        } else if (e.key === '+') {
            e.preventDefault()
            setRating((r) => Math.min(10, (r ?? 5) + 0.5))
        } else if (e.key === '-') {
            e.preventDefault()
            setRating((r) => Math.max(0, (r ?? 5) - 0.5))
        }
    }

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setError('')
        const completion: Completion = {
            rating,
            // Mediodía local: la fecha no cambia de día al pasarla a UTC.
            completedAt: new Date(`${date}T12:00:00`).toISOString(),
            review: review.trim() || null,
        }
        try {
            await saveCompletion(game.appid, completion)
            onSaved(game.appid, completion)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo guardar')
            setSaving(false)
        }
    }

    return (
        <form onSubmit={submit} className="complete-form">
            <DialogHeader>
                <DialogTitle className="complete-form__title">
                    <Flag size={18} aria-hidden /> Completado
                </DialogTitle>
                <p className="complete-form__game">{game.name ?? `App ${game.appid}`}</p>
            </DialogHeader>

            <div className="complete-form__field">
                <div className="complete-form__label-row">
                    <label htmlFor="complete-rating" className="field__label">Nota</label>
                    {rating !== null && (
                        <button type="button" className="complete-form__link" onClick={() => setRating(null)}>
                            Sin nota
                        </button>
                    )}
                </div>
                <div className="complete-rating">
                    <span className={`complete-rating__value ${rating === null ? 'is-empty' : ''}`} aria-hidden>
                        <Star size={18} />
                        {rating === null ? '—' : rating.toLocaleString('es-ES', { minimumFractionDigits: 1 })}
                    </span>
                    <input
                        id="complete-rating"
                        type="range"
                        min={0}
                        max={10}
                        step={0.5}
                        value={rating ?? 5}
                        autoFocus
                        className={`complete-rating__slider ${rating === null ? 'is-empty' : ''}`}
                        aria-valuetext={rating === null ? 'Sin nota' : `${rating} de 10`}
                        onChange={(e) => setRating(Number(e.target.value))}
                        onKeyDown={onRatingKey}
                    />
                </div>
                <p className="complete-form__hint">Flechas: ±0,5 · una cifra: esa nota · Intro: guardar</p>
            </div>

            <div className="complete-form__field">
                <label htmlFor="complete-date" className="field__label">Fecha</label>
                <input
                    id="complete-date"
                    type="date"
                    className="hg-input"
                    required
                    value={date}
                    max={toDateInput(new Date().toISOString())}
                    onChange={(e) => setDate(e.target.value)}
                />
                {suggestion && (
                    <p className="complete-form__hint">
                        Sugerida: {suggestion.source === 'logro' ? 'tu último logro' : 'tu última partida'} (
                        <button
                            type="button"
                            className="complete-form__link"
                            onClick={() => setDate(toDateInput(suggestion.date))}
                        >
                            {SHORT_DATE.format(new Date(suggestion.date))}
                        </button>
                        )
                    </p>
                )}
            </div>

            <div className="complete-form__field">
                <label htmlFor="complete-review" className="field__label">Reseña (opcional)</label>
                <textarea
                    id="complete-review"
                    className="hg-input complete-form__review"
                    rows={3}
                    value={review}
                    placeholder="¿Qué te ha parecido?"
                    onChange={(e) => setReview(e.target.value)}
                />
            </div>

            {error && (
                <p className="alert alert--error" role="alert">
                    {error}
                </p>
            )}

            <div className="complete-form__actions">
                <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>
                    Cancelar
                </Button>
                <Button type="submit" loading={saving}>
                    {saving ? 'Guardando…' : 'Guardar'}
                </Button>
            </div>
        </form>
    )
}

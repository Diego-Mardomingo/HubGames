'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Flag, Pause, Trophy } from 'lucide-react'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import { dismissSuggestion, formatHours, setGamesStatus, type LibraryGame } from '@/lib/tracker'
import { isPerfect } from '@/lib/tracker-rules'
import { Button } from '@/components/ui/button'
import CompleteDialog from './CompleteDialog'
import './tracker.css'

/**
 * Sugerencias de la sincronización (#18): "¿Lo has terminado?" y "¿Lo dejas en pausa?", resueltas con un clic.
 * Vive en el dashboard (#29).
 */
export default function SuggestionsPanel() {
    const [games, setGames] = useState<LibraryGame[]>([])
    const [completing, setCompleting] = useState<LibraryGame | null>(null)
    const [error, setError] = useState('')
    /** Respuesta guardándose ("123:pausar", "123:descartar"): su botón gira y los de ese juego esperan. */
    const [pending, setPending] = useState<string | null>(null)
    /** Completado en el diálogo, que se quita de la lista al cerrarlo. */
    const completedRef = useRef<number | null>(null)

    useEffect(() => {
        safeGetSession().then(async ({ data: { session } }) => {
            if (!session) return
            const { data } = await supabase
                .from('hubgames_library')
                .select('*')
                .not('suggestion', 'is', null)
                .order('rtime_last_played', { ascending: false, nullsFirst: false })
            setGames((data ?? []) as LibraryGame[])
        })
    }, [])

    function resolved(appid: number) {
        setGames((list) => list.filter((g) => g.appid !== appid))
    }

    async function run(appid: number, kind: 'pausar' | 'descartar', action: () => Promise<void>) {
        setPending(`${appid}:${kind}`)
        setError('')
        try {
            await action()
            resolved(appid)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo guardar')
        } finally {
            setPending(null)
        }
    }

    if (games.length === 0) return null

    return (
        <section className="suggestions glass" aria-label="Sugerencias">
            <h2 className="suggestions__title">¿Cómo van tus juegos?</h2>
            {error && (
                <p className="alert alert--error" role="alert">
                    {error}
                </p>
            )}
            <ul className="suggestions__list">
                <AnimatePresence initial={false}>
                    {games.map((game) => (
                        <motion.li
                            key={game.appid}
                            layout
                            className="suggestion"
                            exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
                        >
                            {game.header_image ? (
                                <img className="suggestion__cover" src={game.header_image} alt="" loading="lazy" />
                            ) : (
                                <span className="suggestion__cover" aria-hidden />
                            )}
                            <div className="suggestion__text">
                                <p className="suggestion__question">
                                    {game.suggestion === 'completado' ? '¿Lo has terminado?' : '¿Lo dejas en pausa?'}
                                </p>
                                <p className="suggestion__game">
                                    {game.name ?? `App ${game.appid}`}
                                    {isPerfect(game) && (
                                        <span className="badge-100" title="Todos los logros desbloqueados">
                                            <Trophy size={11} aria-hidden /> 100%
                                        </span>
                                    )}
                                </p>
                                <p className="suggestion__meta">
                                    {formatHours(game.playtime_forever)}
                                    {game.rtime_last_played &&
                                        ` · última partida el ${new Date(game.rtime_last_played).toLocaleDateString('es-ES')}`}
                                </p>
                            </div>
                            <div className="suggestion__actions">
                                {game.suggestion === 'completado' ? (
                                    <Button type="button" size="sm" disabled={pending?.startsWith(`${game.appid}:`)} onClick={() => setCompleting(game)}>
                                        <Flag aria-hidden /> Sí, completado
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        size="sm"
                                        loading={pending === `${game.appid}:pausar`}
                                        disabled={pending?.startsWith(`${game.appid}:`)}
                                        onClick={() => run(game.appid, 'pausar', () => setGamesStatus([game.appid], 'pausado'))}
                                    >
                                        <Pause aria-hidden /> Pausar
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    loading={pending === `${game.appid}:descartar`}
                                    disabled={pending?.startsWith(`${game.appid}:`)}
                                    onClick={() => run(game.appid, 'descartar', () => dismissSuggestion(game.appid))}
                                >
                                    {game.suggestion === 'completado' ? 'Todavía no' : 'Sigo con él'}
                                </Button>
                            </div>
                        </motion.li>
                    ))}
                </AnimatePresence>
            </ul>
            <CompleteDialog
                games={completing ? [completing] : null}
                onClose={() => {
                    // Se quita de la lista al cerrar, tras la celebración: si era la última, el panel desaparece con el diálogo.
                    if (completedRef.current !== null) resolved(completedRef.current)
                    completedRef.current = null
                    setCompleting(null)
                }}
                onSaved={([s]) => {
                    completedRef.current = s.appid
                }}
            />
        </section>
    )
}

'use client'

import { useEffect, useState } from 'react'
import { Check, Heart, ListPlus, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'
import { setGamesStatus, type GameStatus } from '@/lib/tracker'
import { addToWishlist } from '@/lib/wishlist'
import { judiShareText } from '@/lib/judi'

type Ownership = { status: GameStatus | null; wished: boolean }

/**
 * Al terminar un JUDI (#38): pasarlo a pendientes si lo tienes, o a la wishlist si no, y compartir el resultado.
 * Lo de la biblioteca solo con sesión; compartir también como invitado.
 */
export default function JudiFinishActions({
    game,
    appid,
    state,
    failed,
    loggedIn,
}: {
    game: { id: number; fecha: string }
    appid: number | null
    state: 'won' | 'lost'
    failed: number
    loggedIn: boolean
}) {
    const [ownership, setOwnership] = useState<Ownership | null>(null)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    useEffect(() => {
        if (!loggedIn || !appid) return
        let cancelled = false
        void Promise.all([
            supabase.from('hubgames_user_games').select('status').eq('appid', appid).maybeSingle(),
            supabase.from('hubgames_user_wishlist').select('appid').eq('appid', appid).maybeSingle(),
        ]).then(([games, wishlist]) => {
            if (cancelled) return
            setOwnership({ status: (games.data?.status as GameStatus | undefined) ?? null, wished: !!wishlist.data })
        })
        return () => {
            cancelled = true
        }
    }, [loggedIn, appid])

    async function run(action: () => Promise<void>, done: Partial<Ownership>) {
        setSaving(true)
        setMessage(null)
        try {
            await action()
            setOwnership((o) => (o ? { ...o, ...done } : o))
        } catch (e) {
            setMessage(e instanceof Error ? e.message : 'No se pudo guardar')
        } finally {
            setSaving(false)
        }
    }

    async function share() {
        const text = judiShareText(game, state, failed, `${window.location.origin}/judi`)
        setMessage(null)
        try {
            if (navigator.share) {
                await navigator.share({ text })
                return
            }
            await navigator.clipboard.writeText(text)
            setMessage('Resultado copiado')
        } catch (e) {
            // Cerrar el diálogo de compartir no es un error.
            if (e instanceof DOMException && e.name === 'AbortError') return
            try {
                await navigator.clipboard.writeText(text)
                setMessage('Resultado copiado')
            } catch {
                setMessage('No se pudo compartir')
            }
        }
    }

    return (
        <div className="result__extra">
            <div className="result__extra-row">
                {ownership && appid &&
                    (ownership.status === 'pendiente' ? (
                        <span className="result__done">
                            <Check size={14} aria-hidden /> En pendientes
                        </span>
                    ) : ownership.status ? (
                        <Button
                            size="sm"
                            variant="secondary"
                            disabled={saving}
                            onClick={() => run(() => setGamesStatus([appid], 'pendiente'), { status: 'pendiente' })}
                        >
                            <ListPlus aria-hidden /> Añadir a pendientes
                        </Button>
                    ) : ownership.wished ? (
                        <span className="result__done">
                            <Heart size={14} aria-hidden /> En tu wishlist
                        </span>
                    ) : (
                        <Button size="sm" variant="secondary" disabled={saving} onClick={() => run(() => addToWishlist(appid), { wished: true })}>
                            <Heart aria-hidden /> Añadir a la wishlist
                        </Button>
                    ))}
                <Button size="sm" variant="ghost" onClick={() => void share()}>
                    <Share2 aria-hidden /> Compartir
                </Button>
            </div>
            {message && (
                <p className="result__msg" role="status">
                    {message}
                </p>
            )}
        </div>
    )
}

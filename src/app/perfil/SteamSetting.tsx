'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Gamepad2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { Database } from '@/lib/supabase/database.types'

type SteamLink = Database['public']['Tables']['hubgames_user_steam']['Row']

const STATUS_MESSAGES: Record<string, { ok: boolean; text: string }> = {
    ok: { ok: true, text: 'Steam vinculado correctamente.' },
    privado: { ok: false, text: 'Steam vinculado, pero tu perfil es privado.' },
    detalles_privados: { ok: false, text: 'Steam vinculado, pero los detalles de juego son privados.' },
    desconocida: { ok: false, text: 'Steam vinculado, pero no se pudo leer tu perfil.' },
    en_uso: { ok: false, text: 'Esa cuenta de Steam ya está vinculada a otro usuario.' },
    error: { ok: false, text: 'No se pudo vincular Steam. Inténtalo de nuevo.' },
}

export default function SteamSetting() {
    const router = useRouter()
    const params = useSearchParams()
    const [link, setLink] = useState<SteamLink | null>(null)
    const [loaded, setLoaded] = useState(false)
    const [busy, setBusy] = useState(false)
    const message = STATUS_MESSAGES[params.get('steam') ?? '']

    useEffect(() => {
        supabase
            .from('hubgames_user_steam')
            .select('*')
            .maybeSingle()
            .then(({ data }) => {
                setLink(data)
                setLoaded(true)
            })
    }, [params])

    async function unlink() {
        if (!window.confirm('¿Desvincular Steam? Se borrarán tus datos de Steam en HubGames.')) return
        setBusy(true)
        const res = await fetch('/api/steam/unlink', { method: 'POST' })
        setBusy(false)
        if (res.ok) {
            setLink(null)
            router.replace('/perfil')
        }
    }

    const needsFix = link && (link.visibility === 'privado' || link.visibility === 'detalles_privados')

    return (
        <div className="setting glass">
            <div className="setting__head">
                <span className={`setting__icon ${link ? '' : 'is-muted'}`} aria-hidden>
                    <Gamepad2 size={17} />
                </span>
                <div className="setting__text">
                    <p className="setting__title">Steam</p>
                    <p className="setting__desc">
                        {!loaded
                            ? 'Cargando…'
                            : link
                              ? `${link.persona_name ?? link.steamid} · vinculado el ${new Date(link.linked_at).toLocaleDateString('es-ES')}`
                              : 'Conecta tu cuenta para traer tus juegos y logros'}
                    </p>
                </div>
            </div>
            {link && (
                <p className="setting__desc">
                    Última sincronización:{' '}
                    {link.last_sync_at ? new Date(link.last_sync_at).toLocaleString('es-ES') : 'todavía no'}
                </p>
            )}
            {needsFix && (
                <p className="setting__desc" role="alert">
                    En Steam → Editar perfil → Configuración de privacidad: pon el perfil y los detalles del juego
                    en <strong>Público</strong> y desmarca «Mantener siempre privado mi tiempo de juego total».
                    Después vuelve a conectar.
                </p>
            )}
            {message && (
                <p className="setting__desc" role="status" style={{ color: message.ok ? undefined : 'var(--destructive, #f87171)' }}>
                    {message.text}
                </p>
            )}
            {loaded &&
                (link ? (
                    <div className="setting__form">
                        {needsFix && (
                            <Button asChild variant="secondary">
                                <a href="/api/steam/link">Volver a comprobar</a>
                            </Button>
                        )}
                        <Button type="button" variant="secondary" disabled={busy} onClick={unlink}>
                            Desvincular
                        </Button>
                    </div>
                ) : (
                    <Button asChild>
                        <a href="/api/steam/link">Conectar con Steam</a>
                    </Button>
                ))}
        </div>
    )
}

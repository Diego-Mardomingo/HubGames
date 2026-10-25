'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
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

const RELATIVE = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' })

/** "hace 5 minutos", "ayer"… Solo pasado: con relojes desfasados, nunca "dentro de…". */
function timeAgo(iso: string): string {
    const seconds = Math.min(0, Math.round((Date.parse(iso) - Date.now()) / 1000))
    const units: [Intl.RelativeTimeFormatUnit, number][] = [['day', 86400], ['hour', 3600], ['minute', 60]]
    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) return RELATIVE.format(Math.round(seconds / size), unit)
    }
    return 'hace un momento'
}

export default function SteamSetting() {
    const router = useRouter()
    const params = useSearchParams()
    const [link, setLink] = useState<SteamLink | null>(null)
    const [loaded, setLoaded] = useState(false)
    const [busy, setBusy] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [syncMessage, setSyncMessage] = useState<{ ok: boolean; text: string } | null>(null)
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

    async function syncNow() {
        setSyncing(true)
        setSyncMessage(null)
        const res = await fetch('/api/steam/sync', { method: 'POST' })
        const body = await res.json().catch(() => ({}))
        setSyncing(false)
        if (res.ok) {
            setSyncMessage(
                body.status === 'parcial'
                    ? { ok: true, text: 'Sincronizado. Queda algo pendiente: se completará en la próxima sincronización.' }
                    : { ok: true, text: 'Sincronizado.' },
            )
            const { data } = await supabase.from('hubgames_user_steam').select('*').maybeSingle()
            setLink(data)
        } else if (res.status === 429) {
            const minutes = Math.max(1, Math.ceil((body.retryAfter ?? 60) / 60))
            setSyncMessage({ ok: false, text: `Ya se sincronizó hace poco. Vuelve a intentarlo en ${minutes} min.` })
        } else {
            setSyncMessage({ ok: false, text: body.error ?? 'No se pudo sincronizar. Inténtalo de nuevo.' })
        }
    }

    const needsFix = link && (link.visibility === 'privado' || link.visibility === 'detalles_privados')

    return (
        <section className="pf-section" aria-labelledby="pf-steam">
            <h2 id="pf-steam" className="pf-section__title">
                Steam
            </h2>
            <div className="pf-rows">
                <div className="pf-row pf-row--inline">
                    <div className="pf-row__text">
                        <span className="pf-row__label">Cuenta de Steam</span>
                        <p className="pf-row__desc">
                            {!loaded
                                ? 'Cargando…'
                                : link
                                  ? `${link.persona_name ?? link.steamid} · vinculada el ${new Date(link.linked_at).toLocaleDateString('es-ES')}`
                                  : 'Conéctala para traer tus juegos y logros.'}
                        </p>
                    </div>
                    {loaded && (
                        <div className="pf-row__control">
                            {link ? (
                                <>
                                    {needsFix && (
                                        <Button asChild variant="secondary">
                                            <a href="/api/steam/link">Volver a comprobar</a>
                                        </Button>
                                    )}
                                    <Button type="button" variant="secondary" disabled={busy} onClick={unlink}>
                                        Desvincular
                                    </Button>
                                </>
                            ) : (
                                <Button asChild>
                                    <a href="/api/steam/link">Conectar con Steam</a>
                                </Button>
                            )}
                        </div>
                    )}
                </div>
                {link && (
                    <div className="pf-row pf-row--inline">
                        <div className="pf-row__text">
                            <span className="pf-row__label">Última sincronización</span>
                            <p className="pf-row__desc">
                                {link.last_sync_at ? (
                                    <time dateTime={link.last_sync_at} title={new Date(link.last_sync_at).toLocaleString('es-ES')}>
                                        {timeAgo(link.last_sync_at)}
                                    </time>
                                ) : (
                                    'Todavía no'
                                )}
                            </p>
                        </div>
                        {!needsFix && (
                            <div className="pf-row__control">
                                <Button type="button" disabled={syncing} onClick={syncNow}>
                                    <RefreshCw size={14} className={syncing ? 'hg-spin' : ''} aria-hidden />
                                    {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
                {(needsFix || message || syncMessage) && (
                    <div className="pf-row pf-row--notes">
                        {needsFix && (
                            <p className="alert alert--error" role="alert">
                                <span>
                                    En Steam → Editar perfil → Configuración de privacidad: pon el perfil y los detalles del juego en{' '}
                                    <strong>Público</strong> y desmarca «Mantener siempre privado mi tiempo de juego total». Después
                                    vuelve a comprobar.
                                </span>
                            </p>
                        )}
                        {message && (
                            <p className={`alert ${message.ok ? 'alert--ok' : 'alert--error'}`} role="status">
                                {message.text}
                            </p>
                        )}
                        {syncMessage && (
                            <p className={`alert ${syncMessage.ok ? 'alert--ok' : 'alert--error'}`} role="status">
                                {syncMessage.text}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </section>
    )
}

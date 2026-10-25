'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** "Sincronizar ahora" (#14) en el dashboard: al terminar, vuelve a pedir los datos de la página. */
export default function SyncButton() {
    const router = useRouter()
    const [syncing, setSyncing] = useState(false)
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

    async function sync() {
        setSyncing(true)
        setMessage(null)
        const res = await fetch('/api/steam/sync', { method: 'POST' })
        const body = await res.json().catch(() => ({}))
        setSyncing(false)
        if (res.ok) {
            setMessage({ ok: true, text: body.status === 'parcial' ? 'Sincronizado (queda algo para la próxima)' : 'Sincronizado' })
            router.refresh()
        } else if (res.status === 429) {
            const minutes = Math.max(1, Math.ceil((body.retryAfter ?? 60) / 60))
            setMessage({ ok: false, text: `Ya se sincronizó hace poco. Prueba en ${minutes} min` })
        } else {
            setMessage({ ok: false, text: body.error ?? 'No se pudo sincronizar' })
        }
    }

    return (
        <div className="dash-sync">
            <Button type="button" disabled={syncing} onClick={sync}>
                <RefreshCw className={syncing ? 'animate-spin' : ''} aria-hidden />
                {syncing ? 'Sincronizando…' : 'Sincronizar'}
            </Button>
            {message && (
                <span className={`dash-sync__msg ${message.ok ? '' : 'is-error'}`} role="status">
                    {message.text}
                </span>
            )}
        </div>
    )
}

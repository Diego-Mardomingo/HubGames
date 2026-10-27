'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import './dashboard.css'

type Props = {
    /** Texto del botón (por defecto «Sincronizar»). */
    label?: string
    variant?: 'default' | 'secondary'
    className?: string
    /** Al terminar bien; para páginas que cargan sus datos en el navegador (la bandeja). */
    onSynced?: () => void
}

/** "Sincronizar ahora" (#14) en el dashboard y la bandeja vacía: al terminar, vuelve a pedir los datos de la página. */
export default function SyncButton({ label = 'Sincronizar', variant = 'default', className, onSynced }: Props = {}) {
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
            onSynced?.()
        } else if (res.status === 429) {
            const minutes = Math.max(1, Math.ceil((body.retryAfter ?? 60) / 60))
            setMessage({ ok: false, text: `Ya se sincronizó hace poco. Prueba en ${minutes} min` })
        } else {
            setMessage({ ok: false, text: body.error ?? 'No se pudo sincronizar' })
        }
    }

    return (
        <div className={className ? `dash-sync ${className}` : 'dash-sync'}>
            <Button type="button" variant={variant} disabled={syncing} onClick={sync}>
                <RefreshCw className={syncing ? 'hg-spin' : ''} aria-hidden />
                {syncing ? 'Sincronizando…' : label}
            </Button>
            {message && (
                <span className={`dash-sync__msg ${message.ok ? '' : 'is-error'}`} role="status">
                    {message.ok && <Check aria-hidden className="hg-draw" />}
                    {message.text}
                </span>
            )}
        </div>
    )
}

'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, CircleCheck, Clock, EyeOff, Link2, Lock, RefreshCw, TriangleAlert, Unlink } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { Database } from '@/lib/supabase/database.types'
import { STEAM_STATE_META, steamNeedsFix, steamState, timeAgo, type SteamState } from '@/lib/profile'
import { PfSection, enter } from './Section'
import FamilySetting from './FamilySetting'

export type SteamLink = Database['public']['Tables']['hubgames_user_steam']['Row']

type Msg = { tone: 'ok' | 'error' | 'warn'; text: string }

/** Vuelta de /api/steam/link (?steam=…). Perfil o detalles privados no llevan mensaje: ya lo dice el estado con sus pasos. */
const STATUS_MESSAGES: Record<string, Msg> = {
    ok: { tone: 'ok', text: 'Steam vinculado correctamente.' },
    desconocida: { tone: 'warn', text: 'Steam vinculado, pero no se pudo leer tu perfil.' },
    en_uso: { tone: 'error', text: 'Esa cuenta de Steam ya está vinculada a otro usuario.' },
    error: { tone: 'error', text: 'No se pudo vincular Steam. Inténtalo de nuevo.' },
}

const STATE_ICON: Record<SteamState, typeof CircleCheck> = {
    ok: CircleCheck,
    privado: Lock,
    detalles: EyeOff,
    desconocida: TriangleAlert,
    none: Unlink,
}

const FIX_STEPS: Record<'privado' | 'detalles', { title: string; steps: ReactNode[] }> = {
    privado: {
        title: 'Tu perfil de Steam es privado: no podemos leer tus juegos.',
        steps: [
            <>
                En Steam, abre <b>Editar perfil</b> → <b>Configuración de privacidad</b>.
            </>,
            <>
                Pon <b>Mi perfil</b> y <b>Detalles de juego</b> en «Público».
            </>,
            <>Desmarca «Mantener siempre privado mi tiempo de juego total».</>,
            <>Vuelve aquí y pulsa «Volver a comprobar».</>,
        ],
    },
    detalles: {
        title: 'Tus detalles de juego son privados: no vemos tus juegos ni tus horas.',
        steps: [
            <>
                En Steam, <b>Editar perfil</b> → <b>Configuración de privacidad</b>: pon <b>Detalles de juego</b> en «Público».
            </>,
            <>Desmarca «Mantener siempre privado mi tiempo de juego total».</>,
            <>Vuelve aquí y pulsa «Volver a comprobar».</>,
        ],
    },
}

function Alert({ msg }: { msg: Msg }) {
    const Icon = msg.tone === 'ok' ? CircleCheck : msg.tone === 'warn' ? Clock : TriangleAlert
    return (
        <p className={`alert alert--${msg.tone} pf-alert`} role="status">
            <Icon className={msg.tone === 'ok' ? 'hg-draw' : undefined} aria-hidden />
            <span>{msg.text}</span>
        </p>
    )
}

/**
 * Steam: lo que se hace con la cuenta (sincronizar, arreglar la privacidad, conectar). Su avatar y nombre están en la tarjeta
 * de usuario y «Desvincular» en la zona «Salir». El color es su estado: verde conectada, ámbar si hay que arreglar algo, neutro sin vincular.
 */
export default function SteamSetting({ link, onLink, index }: { link: SteamLink | null; onLink: (link: SteamLink | null) => void; index: number }) {
    const params = useSearchParams()
    const [syncing, setSyncing] = useState(false)
    const [synced, setSynced] = useState(false)
    const [syncMessage, setSyncMessage] = useState<Msg | null>(null)
    const doneTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
    const message = STATUS_MESSAGES[params.get('steam') ?? '']
    const state = steamState(link)
    const meta = STEAM_STATE_META[state]
    const StateIcon = STATE_ICON[state]
    const needsFix = steamNeedsFix(state)

    useEffect(() => () => clearTimeout(doneTimer.current), [])

    async function syncNow() {
        setSyncing(true)
        setSyncMessage(null)
        const res = await fetch('/api/steam/sync', { method: 'POST' })
        const body = await res.json().catch(() => ({}))
        setSyncing(false)
        if (res.ok) {
            if (body.status === 'parcial') {
                setSyncMessage({ tone: 'ok', text: 'Sincronizado. Queda algo pendiente: se completará en la próxima sincronización.' })
            }
            setSynced(true)
            clearTimeout(doneTimer.current)
            doneTimer.current = setTimeout(() => setSynced(false), 1800)
            const { data } = await supabase.from('hubgames_user_steam').select('*').maybeSingle()
            onLink(data)
        } else if (res.status === 429) {
            const minutes = Math.max(1, Math.ceil((body.retryAfter ?? 60) / 60))
            setSyncMessage({ tone: 'warn', text: `Ya se sincronizó hace poco. Vuelve a intentarlo en ${minutes} min.` })
        } else {
            setSyncMessage({ tone: 'error', text: body.error ?? 'No se pudo sincronizar. Inténtalo de nuevo.' })
        }
    }

    const chip = (
        <span key={state} className={`pf-state hg-tint ${meta.tone}`}>
            <StateIcon aria-hidden />
            {meta.label}
        </span>
    )

    return (
        <PfSection id="pf-steam" tone={meta.tone} icon={<Link2 />} title="Steam" end={chip} className={`pf-steam ${meta.tone}`} style={enter(index)}>
            {!link ? (
                <div className="pf-row">
                    <div className="pf-connect">
                        <span className="pf-connect__icon hg-tint st-todos" aria-hidden>
                            <Link2 />
                        </span>
                        <div className="pf-row__text">
                            <span className="pf-row__label">Conecta tu cuenta de Steam</span>
                            <p className="pf-row__desc">Para traer tus juegos, horas y logros. Solo lectura: no publica nada en tu nombre.</p>
                        </div>
                        <Button asChild>
                            <a href="/api/steam/link">
                                <Link2 data-icon="inline-start" aria-hidden /> Conectar con Steam
                            </a>
                        </Button>
                    </div>
                </div>
            ) : (
                <>
                    {needsFix && (
                        <div className="pf-row">
                            <div className="pf-fix" role="alert">
                                <p className="pf-fix__title">
                                    <TriangleAlert aria-hidden />
                                    {FIX_STEPS[state as 'privado' | 'detalles'].title}
                                </p>
                                <ol>
                                    {FIX_STEPS[state as 'privado' | 'detalles'].steps.map((step, i) => (
                                        <li key={i}>{step}</li>
                                    ))}
                                </ol>
                                <div className="pf-fix__acts">
                                    <Button asChild>
                                        <a href="/api/steam/link">
                                            <RefreshCw data-icon="inline-start" aria-hidden /> Volver a comprobar
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className={`pf-row pf-row--inline${needsFix ? '' : ' pf-row--stack-sm'}`}>
                        <div className="pf-row__text">
                            <span className="pf-row__label">Última sincronización</span>
                            <p className="pf-row__desc">
                                {link.last_sync_at ? (
                                    <time key={link.last_sync_at} className="pf-time" dateTime={link.last_sync_at} title={new Date(link.last_sync_at).toLocaleString('es-ES')}>
                                        {timeAgo(link.last_sync_at)}
                                    </time>
                                ) : (
                                    'Todavía no'
                                )}
                                {needsFix
                                    ? ' · sin datos nuevos hasta que lo arregles'
                                    : ` · vinculada el ${new Date(link.linked_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                            </p>
                        </div>
                        {!needsFix && (
                            <div className="pf-row__control">
                                <Button type="button" disabled={syncing || synced} onClick={syncNow} className={synced ? 'is-done' : undefined}>
                                    {synced ? (
                                        <>
                                            <Check className="hg-draw" data-icon="inline-start" aria-hidden /> Sincronizado
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className={syncing ? 'hg-spin' : undefined} data-icon="inline-start" aria-hidden />
                                            {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                    {!needsFix && <FamilySetting link={link} onLink={onLink} />}
                </>
            )}
            {(message || syncMessage) && (
                <div className="pf-notes">
                    {message && <Alert msg={message} />}
                    {syncMessage && <Alert key={syncMessage.text} msg={syncMessage} />}
                </div>
            )}
        </PfSection>
    )
}

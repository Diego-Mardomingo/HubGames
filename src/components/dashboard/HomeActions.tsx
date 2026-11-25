'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ExternalLink, Plus } from 'lucide-react'
import { addToPending, setGamesStatus } from '@/lib/tracker'
import { announceListMove } from './ListShortcuts'

/** Aparcados: «Dejarlo» (a Abandonado) o «Retomar» (a Jugando). La tarjeta se queda con lo que elegiste hasta recargar. */
export function ParkedActions({ appid, status, name }: { appid: number; status: string; name: string }) {
    const router = useRouter()
    const [busy, setBusy] = useState(false)
    const [done, setDone] = useState<'abandonado' | 'jugando' | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function move(to: 'abandonado' | 'jugando') {
        setBusy(true)
        setError(null)
        try {
            if (to !== status) await setGamesStatus([appid], to)
            announceListMove(status, to)
            setDone(to)
            router.refresh()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo cambiar')
        } finally {
            setBusy(false)
        }
    }

    if (done)
        return (
            <p className="home-park__done" role="status">
                <Check aria-hidden /> {done === 'jugando' ? 'Vuelve a Jugando' : 'Pasa a Abandonados'}
            </p>
        )
    return (
        <div className="home-park__acts">
            <button type="button" className="home-btn home-btn--ghost" disabled={busy} onClick={() => move('abandonado')} aria-label={`Dejar ${name}`}>
                Dejarlo
            </button>
            <button type="button" className="home-btn" disabled={busy} onClick={() => move('jugando')} aria-label={`Retomar ${name}`}>
                Retomar
            </button>
            {error && (
                <span className="home-err" role="alert">
                    {error}
                </span>
            )}
        </div>
    )
}

/** Sale pronto: añadir a Pendientes (aquí) y, si no está en tu wishlist, abrir su página de Steam para añadirlo allí. */
export function SoonActions({ appid, name, pending: initial, wishlist }: { appid: number; name: string; pending: boolean; wishlist: boolean }) {
    const [pending, setPending] = useState(initial)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function add() {
        setBusy(true)
        setError(null)
        try {
            await addToPending(appid)
            announceListMove('', 'pendiente')
            setPending(true)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo añadir')
        } finally {
            setBusy(false)
        }
    }

    return (
        <span className="home-soon__acts">
            {pending ? (
                <span className="home-add is-on">
                    <Check aria-hidden /> En pendientes
                </span>
            ) : (
                <button type="button" className="home-add" disabled={busy} onClick={add} title={error ?? `Añadir ${name} a Pendientes`}>
                    <Plus aria-hidden /> Pendientes
                </button>
            )}
            {!wishlist && (
                <a
                    className="home-add"
                    href={`https://store.steampowered.com/app/${appid}/`}
                    target="_blank"
                    rel="noreferrer"
                    title={`Abrir ${name} en Steam para añadirlo a tu lista de deseados`}
                >
                    <ExternalLink aria-hidden /> Wishlist
                </a>
            )}
            {error && (
                <span className="sr-only" role="alert">
                    {error}
                </span>
            )}
        </span>
    )
}

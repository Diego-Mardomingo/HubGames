'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCheck, Library, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AnimatedCount from '@/components/AnimatedCount'
import SyncButton from '@/components/dashboard/SyncButton'
import { LIST_ICONS, StatusChip } from '@/components/tracker/status'
import { STATUS_LABELS } from '@/lib/tracker'
import { sessionSegments, sessionTotal, TRAY_DESTINATIONS, type TrayDestination, type TraySession } from '@/lib/tray'

/** Barra apilada con los colores de cada lista: cada segmento crece (o encoge) hasta su sitio. */
function SessionStack({ session, large }: { session: TraySession; large?: boolean }) {
    let j = 0
    return (
        <span className={`tray-stack${large ? ' tray-stack--lg' : ''}`} aria-hidden>
            {sessionSegments(session).map((s) => (
                <span
                    key={s.status}
                    className={`st-${s.status}`}
                    style={{ '--x': `${s.x}%`, '--f': s.f, '--j': s.f ? j++ : 0 } as CSSProperties}
                />
            ))}
        </span>
    )
}

/** «En esta visita»: cuántos llevas clasificados y su reparto por lista. */
export function TraySessionBox({ session, fresh }: { session: TraySession; fresh: TrayDestination | null }) {
    const total = sessionTotal(session)
    return (
        <div className={`tray-session${total ? '' : ' is-empty'}`} aria-live="polite" aria-hidden={!total}>
            <p className="tray-session__top">
                <span>En esta visita</span>
                <b>
                    <AnimatedCount value={total} /> {total === 1 ? 'clasificado' : 'clasificados'}
                </b>
            </p>
            <SessionStack session={session} />
            <span className="tray-legend">
                {TRAY_DESTINATIONS.filter((s) => session[s]).map((s) => {
                    const Icon = LIST_ICONS[s]
                    return (
                        <span key={s} className={`tray-leg st-${s}${s === fresh ? ' is-new' : ''}`}>
                            <Icon aria-hidden />
                            {STATUS_LABELS[s]} <b>{session[s]}</b>
                        </span>
                    )
                })}
            </span>
        </div>
    )
}

/**
 * Bandeja vacía. Si se ha vaciado en esta visita, celebración contenida (check que se dibuja, puntos con los colores de
 * lo clasificado y reparto que se rellena); si ya estaba vacía al entrar, solo el mensaje y las acciones.
 */
export function TrayEmpty({ session, onSynced }: { session: TraySession; onSynced: () => void }) {
    const total = sessionTotal(session)
    const used = TRAY_DESTINATIONS.filter((s) => session[s])
    return (
        <div className={`tray-empty${total ? ' is-celebrating' : ''}`}>
            <span className="tray-empty__icon hg-tint">
                <CheckCheck aria-hidden className={total ? 'hg-draw' : undefined} />
                {total > 0 && (
                    <span className="tray-burst" aria-hidden>
                        {Array.from({ length: 9 }, (_, i) => (
                            <i key={i} className={`st-${used[i % used.length]}`} style={{ '--a': `${i * 40}deg` } as CSSProperties} />
                        ))}
                    </span>
                )}
            </span>
            <h2>{total ? 'Todo clasificado' : 'Tu bandeja está vacía'}</h2>
            <p>
                {total
                    ? `Has clasificado ${total} ${total === 1 ? 'juego' : 'juegos'} en esta visita. Los nuevos de Steam llegarán aquí al sincronizar.`
                    : 'Los juegos nuevos de Steam llegarán aquí al sincronizar.'}
            </p>
            {total > 0 && (
                <div className="tray-empty__split">
                    <SessionStack session={session} large />
                    <ul className="tray-empty__legend">
                        {used.map((s, j) => {
                            const Icon = LIST_ICONS[s]
                            return (
                                <li key={s} style={{ '--j': j } as CSSProperties}>
                                    <span className={`hg-chip hg-tint st-${s}`}>
                                        <Icon aria-hidden />
                                        {STATUS_LABELS[s]} <b>{session[s]}</b>
                                    </span>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            )}
            <div className="tray-empty__acts">
                <Button asChild>
                    <Link href="/biblioteca">
                        <Library aria-hidden /> Ver la Biblioteca
                    </Link>
                </Button>
                <SyncButton label="Sincronizar con Steam" variant="secondary" className="tray-sync" onSynced={onSynced} />
            </div>
        </div>
    )
}

export interface TrayToastData {
    id: number
    /** Nombre del juego, o null si son varios. */
    name: string | null
    count: number
    status: TrayDestination
}

/** Aviso con «Deshacer» (y Ctrl + Z) durante 5 s. */
export function TrayToast({ toast, onUndo }: { toast: TrayToastData; onUndo: () => void }) {
    return (
        <div className="tray-toast" role="status">
            <span className="tray-toast__text">
                <b>{toast.name ?? `${toast.count} juegos`}</b>
                <ArrowRight aria-hidden />
                <StatusChip status={toast.status} />
            </span>
            <Button type="button" size="sm" variant="ghost" className="tray-toast__undo" onClick={onUndo}>
                <Undo2 aria-hidden /> Deshacer <kbd className="hg-kbd">Ctrl + Z</kbd>
            </Button>
        </div>
    )
}

export interface TrayFlight {
    id: number
    /** Lista de destino (en la biblioteca también las marcas). */
    status: keyof typeof LIST_ICONS
    count: number
    from: { x: number; y: number }
    to: { x: number; y: number }
}

/** Ficha con el icono de la lista que vuela de la fila a «Biblioteca» en la navegación, o al raíl de la biblioteca (440 ms). */
export function TrayFly({ flight, onDone }: { flight: TrayFlight; onDone: (id: number) => void }) {
    const ref = useRef<HTMLSpanElement>(null)
    useEffect(() => {
        const el = ref.current
        if (!el) return
        const dx = flight.to.x - flight.from.x
        const dy = flight.to.y - flight.from.y
        const anim = el.animate(
            [
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                { transform: `translate(${dx * 0.55}px, ${dy * 0.5 - 36}px) scale(0.95)`, opacity: 1, offset: 0.55 },
                { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0 },
            ],
            { duration: 440, easing: 'cubic-bezier(.45, 0, .3, 1)', fill: 'forwards' },
        )
        anim.onfinish = () => onDone(flight.id)
        return () => anim.cancel()
    }, [flight, onDone])
    const Icon = LIST_ICONS[flight.status]
    return (
        <span ref={ref} className={`tray-fly st-${flight.status}`} style={{ left: flight.from.x, top: flight.from.y }} aria-hidden>
            <Icon />
            {flight.count > 1 && <b>{flight.count}</b>}
        </span>
    )
}

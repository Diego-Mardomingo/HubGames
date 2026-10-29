'use client'

import { useState, type ReactNode } from 'react'
import Image from 'next/image'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const fmt = (v: number) => v.toLocaleString('es-ES', { useGrouping: 'always' } as Intl.NumberFormatOptions)

/** Cabecera de un panel: icono, título, recuento y actualizar (el icono gira mientras carga). */
export function PanelHead({ icon, title, count, busy, onRefresh }: { icon: ReactNode; title: string; count?: ReactNode; busy: boolean; onRefresh: () => void }) {
    return (
        <header className="ad-panel__head">
            <span className="ad-panel__icon" aria-hidden>
                {icon}
            </span>
            <h2>{title}</h2>
            {count ? <span className="ad-panel__count">{count}</span> : <span className="ad-panel__count" />}
            <button
                type="button"
                className="hg-icon-btn ad-refresh"
                onClick={onRefresh}
                disabled={busy}
                aria-label={`Actualizar ${title.toLowerCase()}`}
                title="Actualizar"
            >
                <RefreshCw className={busy ? 'hg-spin' : undefined} aria-hidden />
            </button>
        </header>
    )
}

/** Cápsula de Steam (64 × 30) o la inicial con borde discontinuo si no hay imagen o no carga. */
export function Cap({ src, name }: { src: string | null | undefined; name: string }) {
    const [broken, setBroken] = useState(false)
    if (!src || broken)
        return (
            <span className="ad-cap is-empty" aria-hidden>
                {(name.trim()[0] ?? '?').toUpperCase()}
            </span>
        )
    return <Image src={src} alt="" width={64} height={30} className="ad-cap" unoptimized onError={() => setBroken(true)} />
}

export function PanelEmpty({ icon, tone = 'neutral', title, children }: { icon: ReactNode; tone?: string; title: string; children?: ReactNode }) {
    return (
        <div className="ad-empty">
            <span className={`ad-empty__icon hg-tint ${tone}`} aria-hidden>
                {icon}
            </span>
            <p>
                <b>{title}</b>
                {children}
            </p>
        </div>
    )
}

export function PanelError({ what, message, busy, onRetry }: { what: string; message: string; busy: boolean; onRetry: () => void }) {
    return (
        <div className="ad-panel__error">
            <div className="alert alert--error" role="alert">
                <TriangleAlert aria-hidden />
                <span className="ad-panel__error-text">
                    No se pudieron cargar {what}: <span>{message}</span>
                </span>
                <Button type="button" variant="secondary" size="sm" onClick={onRetry} disabled={busy}>
                    <RefreshCw className={busy ? 'hg-spin' : undefined} aria-hidden /> Reintentar
                </Button>
            </div>
        </div>
    )
}

export function PanelLoading() {
    return (
        <div className="ad-skel" aria-busy="true" aria-label="Cargando">
            {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="ad-skel__row" />
            ))}
        </div>
    )
}

/** Pie con «Mostrando N de M» y el botón para ver más. */
export function PanelFoot({ shown, total, more, onMore, loading }: { shown: number; total: string; more: string | null; onMore: () => void; loading?: boolean }) {
    return (
        <div className="ad-foot">
            <span>
                Mostrando {fmt(shown)} de {total}
            </span>
            {more && (
                <Button type="button" variant="secondary" size="sm" onClick={onMore} loading={loading}>
                    {more}
                </Button>
            )}
        </div>
    )
}

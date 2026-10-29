'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AdminTone } from '@/lib/admin'

/**
 * Fila de un log con su detalle, que se despliega debajo (altura con `grid-template-rows`, 240 ms; el chevrón gira).
 * La franja de la izquierda lleva el color del estado si no es correcto. Esc cierra la fila que tiene el foco.
 */
export default function AdminRow({
    rowKey,
    grid,
    tone,
    open,
    onToggle,
    head,
    detail,
}: {
    rowKey: string
    /** Clase de columnas (`ad-g-log`, `ad-g-sync`). */
    grid: string
    tone: AdminTone
    open: boolean
    onToggle: (key: string) => void
    head: ReactNode
    detail: ReactNode
}) {
    const id = useId()
    const ref = useRef<HTMLLIElement>(null)
    const stripe = tone === 'dash-ok' || tone === 'neutral' ? '' : ` ad-item--stripe ${tone}`
    return (
        <li
            ref={ref}
            id={`ad-row-${rowKey}`}
            className={`ad-item${stripe}${open ? ' is-open' : ''}`}
            onKeyDown={(e) => {
                if (e.key === 'Escape' && open) {
                    e.stopPropagation()
                    onToggle(rowKey)
                    ref.current?.querySelector<HTMLButtonElement>('.ad-row')?.focus()
                }
            }}
        >
            <button type="button" className={`ad-row ${grid}`} aria-expanded={open} aria-controls={id} onClick={() => onToggle(rowKey)}>
                {head}
                <span className="ad-chev" aria-hidden>
                    <ChevronDown />
                </span>
            </button>
            <div className="ad-detail" id={id} inert={!open}>
                <div className="ad-detail__in">
                    <div className="ad-detail__box">{detail}</div>
                </div>
            </div>
        </li>
    )
}

/** Botón «Copiar» del detalle: el icono pasa a un check que se dibuja (`.hg-draw`) y vuelve a los 1,6 s. */
export function CopyButton({ text }: { text: string }) {
    const [done, setDone] = useState(false)
    useEffect(() => {
        if (!done) return
        const t = setTimeout(() => setDone(false), 1600)
        return () => clearTimeout(t)
    }, [done])
    return (
        <Button
            type="button"
            variant="secondary"
            size="sm"
            className={done ? 'ad-copied' : undefined}
            onClick={() => {
                navigator.clipboard?.writeText(text).then(
                    () => setDone(true),
                    () => setDone(false),
                )
            }}
        >
            {done ? <Check className="hg-draw" aria-hidden /> : <Copy aria-hidden />}
            {done ? 'Copiado' : 'Copiar'}
        </Button>
    )
}

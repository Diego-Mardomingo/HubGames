'use client'

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

type CSSVars = CSSProperties & Record<`--${string}`, string | number>

const NUMBER = new Intl.NumberFormat('es-ES')

/** Escala «redonda» para el eje: 3–5 marcas enteras (0, 5, 10, 15…) que cubren el máximo. */
export function niceScale(max: number): { top: number; ticks: number[] } {
    if (max <= 0) return { top: 1, ticks: [0] }
    const raw = max / 4
    const magnitude = 10 ** Math.floor(Math.log10(raw))
    const norm = raw / magnitude
    const step = Math.max(1, (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * magnitude)
    const top = Math.ceil(max / step) * step
    return { top, ticks: Array.from({ length: top / step + 1 }, (_, i) => i * step) }
}

export interface Column {
    /** null = aún no ha llegado (hueco con una raya en la base). */
    value: number | null
    label: string
    /** Etiqueta corta para móvil («E» por «ene»). */
    short?: string
    /** Clase de color de la columna (`sc-top`…); por defecto, el acento. */
    tone?: string
    /** Texto para lectores de pantalla. */
    aria: string
}

/**
 * Gráfico de columnas de una serie (logros por mes, notas): rejilla de filetes, columnas finas que crecen desde la base
 * en cadena (al entrar el panel; `.st-panel.is-in`) y el máximo con su cifra. Un solo tooltip por gráfico que aparece
 * con un fundido y, al pasar a otra columna, se desliza en vez de saltar; también con el teclado (cada columna es
 * enfocable). Las demás columnas se apagan al 50 %.
 */
export default function Columns({ columns, tip, height }: { columns: Column[]; tip: (i: number) => ReactNode; height?: number }) {
    const values = columns.map((c) => c.value ?? 0)
    const max = Math.max(...values, 0)
    const { top, ticks } = niceScale(max)
    const peak = max > 0 ? values.indexOf(max) : -1
    const pct = (v: number) => `${(v / top) * 100}%`

    const wrapRef = useRef<HTMLDivElement>(null)
    const tipRef = useRef<HTMLDivElement>(null)
    const target = useRef<HTMLElement | null>(null)
    const [active, setActive] = useState<number | null>(null)

    const show = (i: number, el: HTMLElement) => {
        target.current = el
        setActive(i)
    }
    const hide = () => setActive(null)

    // Coloca el globo encima de la barra (o de la base si no hay), centrado y sin salirse del gráfico. La primera vez
    // aparece en su sitio; después se desliza de una columna a otra.
    useLayoutEffect(() => {
        const t = tipRef.current
        const wrap = wrapRef.current
        const el = target.current
        if (!t || !wrap) return
        if (active === null || !el) {
            t.classList.remove('is-on')
            return
        }
        const wr = wrap.getBoundingClientRect()
        const cr = el.getBoundingClientRect()
        const bar = el.querySelector('.st-col__bar')
        const edge = bar ? bar.getBoundingClientRect().top : cr.bottom - 8
        const x = Math.max(0, Math.min(cr.left - wr.left + cr.width / 2 - t.offsetWidth / 2, wr.width - t.offsetWidth))
        const y = Math.max(-t.offsetHeight, edge - wr.top - t.offsetHeight - 10)
        const wasOn = t.classList.contains('is-on')
        if (!wasOn) t.classList.add('no-move')
        t.style.setProperty('--x', `${x}px`)
        t.style.setProperty('--y', `${y}px`)
        if (!wasOn) {
            void t.offsetWidth
            t.classList.add('is-on')
            requestAnimationFrame(() => t.classList.remove('no-move'))
        }
    }, [active])

    return (
        <div className="st-ch" ref={wrapRef} style={{ '--n': columns.length, ...(height ? { '--h': `${height}px` } : {}) } as CSSVars}>
            <div className="st-ch__axis" aria-hidden>
                {ticks.map((t) => (
                    <span key={t} style={{ bottom: pct(t) }}>
                        {NUMBER.format(t)}
                    </span>
                ))}
            </div>
            <div className="st-ch__plot">
                <div className="st-ch__grid" aria-hidden>
                    {ticks.map((t) => (
                        <i key={t} style={{ bottom: pct(t) }} />
                    ))}
                </div>
                <div className={`st-ch__cols${active !== null ? ' is-hot' : ''}`} onPointerLeave={hide}>
                    {columns.map((c, i) => (
                        <div
                            key={c.label}
                            className={['st-col', c.value === null && 'is-future', active === i && 'is-active'].filter(Boolean).join(' ')}
                            tabIndex={0}
                            role="img"
                            aria-label={c.aria}
                            onPointerEnter={(e) => show(i, e.currentTarget)}
                            onFocus={(e) => show(i, e.currentTarget)}
                            onBlur={hide}
                        >
                            {!!c.value && (
                                <span className={`st-col__bar ${c.tone ?? ''}`} style={{ height: pct(c.value), '--i': i } as CSSVars}>
                                    {i === peak && <span className="st-col__val">{NUMBER.format(c.value)}</span>}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            <div className="st-ch__x" aria-hidden>
                {columns.map((c) => (
                    <span key={c.label} className={c.value === null ? 'is-future' : undefined}>
                        {c.short ? (
                            <>
                                <span className="st-ch__long">{c.label}</span>
                                <span className="st-ch__short">{c.short}</span>
                            </>
                        ) : (
                            c.label
                        )}
                    </span>
                ))}
            </div>
            <div className="st-tip" ref={tipRef} aria-hidden>
                {active !== null && tip(active)}
            </div>
        </div>
    )
}

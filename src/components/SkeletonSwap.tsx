'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** Por debajo de esto el esqueleto no ha llegado a verse (aparece a los 150 ms): el contenido sale sin fundido. */
const SHOWN_AFTER = 150
/** Lo que dura el fundido cruzado (el contenido entra en 220 ms). */
const SWAP_MS = 240

/**
 * Carga de una página cliente: mientras `children` está vacío enseña `skeleton` (la forma real de la página) y, al
 * llegar el contenido, hace un fundido cruzado en la misma celda, sin salto. El contenido que viene de un esqueleto
 * entra solo con fundido (sin la subida de `.hg-enter`, `.hg-from-skel` en lists.css). Si la carga dura menos de
 * 150 ms, el esqueleto no se llega a ver y el contenido sale tal cual.
 *
 * Uso: `if (!data) return <SkeletonSwap skeleton={<X />} />` y, con datos,
 * `return <SkeletonSwap skeleton={<X />}>{vista}</SkeletonSwap>` en la misma posición, para que React conserve el estado.
 *
 * `resetScroll`: sube al principio al montarse. Si una página cliente enseña el esqueleto tras navegar desde otra con
 * scroll, el navegador recorta el scroll mientras la página es corta y lo devuelve a la posición anterior al llegar el
 * contenido; Next no lo corrige porque ya hay algo pintado.
 */
export default function SkeletonSwap({ skeleton, resetScroll = false, children }: { skeleton: ReactNode; resetScroll?: boolean; children?: ReactNode }) {
    const loading = children === undefined || children === null || children === false
    // loading → swap (fundido cruzado) → done; direct: el contenido estaba desde el principio o llegó antes de 150 ms.
    const [phase, setPhase] = useState<'loading' | 'swap' | 'done' | 'direct'>(loading ? 'loading' : 'direct')
    const startedAt = useRef<number | null>(null)

    useEffect(() => {
        if (resetScroll) window.scrollTo(0, 0)
    }, [resetScroll])

    // Antes de pintar: el primer fotograma con contenido ya sale con la fase buena.
    useLayoutEffect(() => {
        if (loading) {
            startedAt.current ??= performance.now()
            // Vuelve a cargar (p. ej. Reintentar)
            setPhase('loading')
            return
        }
        const since = startedAt.current
        startedAt.current = null
        if (since === null) return
        if (performance.now() - since < SHOWN_AFTER) {
            setPhase('direct')
            return
        }
        setPhase('swap')
        const t = window.setTimeout(() => setPhase('done'), SWAP_MS)
        return () => window.clearTimeout(t)
    }, [loading])

    // El esqueleto de cada página lleva su `SkeletonZone` (aviso para lectores de pantalla y aparición a los 150 ms).
    if (loading) return <>{skeleton}</>

    // Mismo árbol en todas las fases (con claves), para que el contenido no se vuelva a montar al quitar el esqueleto.
    const swapping = phase === 'loading' || phase === 'swap'
    return (
        <div className="hg-swap">
            {swapping && (
                <div key="skel" className="hg-swap__skel" aria-hidden>
                    {skeleton}
                </div>
            )}
            <div key="real" className={`hg-swap__real${phase === 'direct' ? '' : ' hg-from-skel'}${swapping ? ' is-swapping' : ''}`}>
                {children}
            </div>
        </div>
    )
}

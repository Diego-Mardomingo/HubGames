'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft } from 'lucide-react'

/**
 * Carrusel del Inicio. Con ratón se agarra y se arrastra (cursor de mano), sigue con inercia al soltar, cede con un
 * muelle si tiras más allá del borde y se posa suavemente en la tarjeta más cercana. Con el dedo, el desplazamiento
 * nativo con su imán (CSS). Las flechas y «Al principio» usan la misma curva.
 */
export default function Carousel({ head, label, className, children }: { head: ReactNode; label: string; className: string; children: ReactNode }) {
    const rail = useRef<HTMLDivElement>(null)
    const [edges, setEdges] = useState({ start: true, end: false, far: false })
    const go = useRef<{ by: (dir: number) => void; start: () => void } | null>(null)

    const sync = useCallback(() => {
        const r = rail.current
        if (!r) return
        const max = r.scrollWidth - r.clientWidth
        const next = { start: r.scrollLeft < 4, end: r.scrollLeft >= max - 4, far: r.scrollLeft > r.clientWidth * 0.6 }
        setEdges((e) => (e.start === next.start && e.end === next.end && e.far === next.far ? e : next))
    }, [])

    useEffect(() => {
        const r = rail.current
        if (!r) return
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const easeOut = (t: number) => 1 - Math.pow(1 - t, 4)
        let raf = 0
        let pull = 0
        const max = () => r.scrollWidth - r.clientWidth
        const stop = () => cancelAnimationFrame(raf)
        const setPull = (v: number) => {
            pull = v
            r.style.setProperty('--pull', `${v.toFixed(2)}px`)
        }
        // Posiciones en las que una tarjeta queda alineada a la izquierda
        const nearest = (x: number) => {
            const first = (r.firstElementChild as HTMLElement | null)?.offsetLeft ?? 0
            const stops = [...r.children].map((c) => Math.min((c as HTMLElement).offsetLeft - first, max()))
            return stops.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a), 0)
        }
        const glide = (to: number, ms: number) => {
            stop()
            const from = r.scrollLeft
            const d = to - from
            if (reduced || Math.abs(d) < 1) {
                r.scrollLeft = to
                return
            }
            const t0 = performance.now()
            const tick = (now: number) => {
                const t = Math.min(1, (now - t0) / ms)
                r.scrollLeft = from + d * easeOut(t)
                if (t < 1) raf = requestAnimationFrame(tick)
            }
            raf = requestAnimationFrame(tick)
        }
        // El tirón de más allá del borde vuelve con un muelle amortiguado
        const springBack = () => {
            let v = 0
            const tick = () => {
                v = (v - pull * 0.14) * 0.74
                setPull(pull + v)
                if (Math.abs(pull) > 0.3 || Math.abs(v) > 0.3) raf = requestAnimationFrame(tick)
                else setPull(0)
            }
            raf = requestAnimationFrame(tick)
        }
        go.current = {
            by: (dir) => glide(nearest(Math.max(0, Math.min(max(), r.scrollLeft + dir * r.clientWidth * 0.9))), 640),
            start: () => glide(0, Math.min(1100, 520 + r.scrollLeft * 0.12)),
        }

        let down = false
        let moved = false
        let x0 = 0
        let s0 = 0
        let lastX = 0
        let lastT = 0
        let vel = 0
        const onDown = (e: PointerEvent) => {
            if (e.pointerType !== 'mouse' || e.button !== 0) return
            // Sin selección de texto ni el arrastre nativo de enlaces e imágenes (cortaba el gesto)
            if (!(e.target as HTMLElement).closest('button')) e.preventDefault()
            stop()
            down = true
            moved = false
            x0 = lastX = e.clientX
            s0 = r.scrollLeft
            lastT = performance.now()
            vel = 0
        }
        const onMove = (e: PointerEvent) => {
            if (!down) return
            const dx = e.clientX - x0
            if (!moved && Math.abs(dx) < 4) return
            if (!moved) {
                moved = true
                r.classList.add('is-grabbing')
            }
            const want = s0 - dx
            const m = max()
            // Dentro, la fila va pegada al ratón; fuera del borde, resistencia que crece cuanto más tiras
            const over = want < 0 ? want : want > m ? want - m : 0
            r.scrollLeft = Math.max(0, Math.min(m, want))
            setPull(over ? -Math.sign(over) * 140 * (1 - Math.exp(-Math.abs(over) / 220)) : 0)
            const now = performance.now()
            vel = 0.7 * ((e.clientX - lastX) / Math.max(1, now - lastT)) * 16 + 0.3 * vel
            lastX = e.clientX
            lastT = now
        }
        const onUp = () => {
            if (!down) return
            down = false
            if (!moved) return
            r.classList.remove('is-grabbing')
            if (performance.now() - lastT > 80) vel = 0 // te paraste antes de soltar: sin lanzamiento
            if (pull) {
                springBack()
                return
            }
            const throwBy = Math.max(-1.4, Math.min(1.4, (vel * 20) / r.clientWidth)) * r.clientWidth
            const target = nearest(Math.max(0, Math.min(max(), r.scrollLeft - throwBy)))
            glide(target, Math.max(380, Math.min(900, 300 + Math.abs(target - r.scrollLeft) * 0.9)))
        }
        // Un arrastre no es un clic: no abre el juego que había debajo
        const onClick = (e: MouseEvent) => {
            if (!moved) return
            e.preventDefault()
            e.stopPropagation()
            moved = false
        }
        const onDragStart = (e: DragEvent) => e.preventDefault()

        r.addEventListener('pointerdown', onDown)
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onUp)
        r.addEventListener('click', onClick, true)
        r.addEventListener('dragstart', onDragStart)
        r.addEventListener('scroll', sync, { passive: true })
        const resize = new ResizeObserver(sync)
        resize.observe(r)
        sync()
        return () => {
            stop()
            r.removeEventListener('pointerdown', onDown)
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
            window.removeEventListener('pointercancel', onUp)
            r.removeEventListener('click', onClick, true)
            r.removeEventListener('dragstart', onDragStart)
            r.removeEventListener('scroll', sync)
            resize.disconnect()
        }
    }, [sync])

    const scrollable = !(edges.start && edges.end)
    return (
        <>
            <div className="home-head">
                {head}
                {scrollable && (
                    <div className="home-car">
                        <button type="button" className={`home-car__start${edges.far ? ' is-on' : ''}`} onClick={() => go.current?.start()} tabIndex={edges.far ? 0 : -1}>
                            <ChevronsLeft aria-hidden /> Al principio
                        </button>
                        <button type="button" onClick={() => go.current?.by(-1)} disabled={edges.start} aria-label="Anteriores">
                            <ChevronLeft aria-hidden />
                        </button>
                        <button type="button" onClick={() => go.current?.by(1)} disabled={edges.end} aria-label="Siguientes">
                            <ChevronRight aria-hidden />
                        </button>
                    </div>
                )}
            </div>
            <div ref={rail} className={`home-rail ${className}`} role="list" aria-label={label}>
                {children}
            </div>
        </>
    )
}

'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

const Revealed = createContext(true)

/** ¿Ha entrado ya en pantalla el bloque que lo contiene? Para arrancar lo que no es CSS (cifras que cuentan). */
export function useRevealed(): boolean {
    return useContext(Revealed)
}

/**
 * Bloque del resumen que se revela al llegar con el scroll, una sola vez por visita: sube y aparece (`.is-in`) y entonces
 * arrancan las animaciones de dentro. Oculto solo dentro de `.wr.anim`; con movimiento reducido o sin JavaScript se ve
 * desde el principio (resumen.css). `initial` lo da por visto desde el servidor (la cabecera).
 */
export default function Reveal({ as: Tag = 'section', className, initial = false, children, ...rest }: {
    as?: 'section' | 'header' | 'div'
    className?: string
    initial?: boolean
    children: ReactNode
    'aria-label'?: string
}) {
    const ref = useRef<HTMLElement>(null)
    const [seen, setSeen] = useState(initial)

    useEffect(() => {
        const el = ref.current
        if (seen || !el || typeof IntersectionObserver === 'undefined') return
        const io = new IntersectionObserver(
            ([e]) => {
                if (!e.isIntersecting) return
                setSeen(true)
                io.disconnect()
            },
            { rootMargin: '0px 0px -8% 0px' },
        )
        io.observe(el)
        return () => io.disconnect()
    }, [seen])

    return (
        <Revealed.Provider value={seen}>
            <Tag ref={ref as never} data-reveal="" className={[className, seen && 'is-in'].filter(Boolean).join(' ')} {...rest}>
                {children}
            </Tag>
        </Revealed.Provider>
    )
}

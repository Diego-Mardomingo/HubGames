'use client'

import { useEffect } from 'react'
import { LogoMark } from '@/components/brand/Logo'

/**
 * `resetScroll`: sube al principio al montarse. Si una página cliente enseña el Loader tras navegar desde otra con
 * scroll, el navegador recorta el scroll mientras la página es corta y lo devuelve a la posición anterior al llegar
 * el contenido; Next no lo corrige porque el Loader ya se ve.
 */
export default function Loader({ label = 'Cargando', resetScroll = false }: { label?: string; resetScroll?: boolean }) {
    useEffect(() => {
        if (resetScroll) window.scrollTo(0, 0)
    }, [resetScroll])

    return (
        <div className="loader-container" role="status" aria-live="polite">
            <LogoMark size={56} loop />
            <span className="loader-container__label">{label}</span>
        </div>
    )
}

import type { CSSProperties, ReactNode } from 'react'
import { LogoMark } from '@/components/brand/Logo'

const at = (i: number) => ({ '--i': i }) as CSSProperties

/**
 * Página de estado (`.hg-status` en globals.css): 404, 404 de juego, error y error global. Tarjeta centrada con el logo
 * animado una vez (`lost` en la 404: la barra que no termina de llenarse; `broken` en el error: cable flojo), un chip,
 * título, texto, extras (la ruta, la sugerencia, el código) y acciones. Entrada con `.hg-enter` y `.hg-pop-in`; los
 * extras llevan la suya con `statusDelay(3)`. `className` para sacudir la tarjeta (`.hg-shake`) si reintentar vuelve a fallar.
 */
export default function StatusPage({
    tone,
    chipIcon,
    chip,
    title,
    text,
    extra,
    actions,
    footer,
    className,
    wrap = true,
}: {
    tone: 'neutral' | 'danger'
    chipIcon: ReactNode
    chip: string
    title: string
    text: ReactNode
    /** Entre el texto y las acciones (la ruta pedida, «¿Querías decir…?»). */
    extra?: ReactNode
    actions: ReactNode
    /** Debajo de las acciones (el código del error, el detalle en desarrollo). */
    footer?: ReactNode
    className?: string
    /** Centrada en el hueco de la página (`.hg-status-wrap`); el error global pone su propio marco. */
    wrap?: boolean
}) {
    const card = (
        <section className={['hg-status', className].filter(Boolean).join(' ')} aria-labelledby="hg-status-title">
            <span className="hg-status__mark hg-enter" style={at(0)}>
                <LogoMark size={64} variant={tone === 'danger' ? 'broken' : 'lost'} />
            </span>
            <span className={`hg-chip hg-tint hg-status__chip--${tone} hg-pop-in`} style={at(0)}>
                {chipIcon}
                {chip}
            </span>
            <h1 className="hg-status__title hg-enter" style={at(1)} id="hg-status-title">
                {title}
            </h1>
            <p className="hg-status__text hg-enter" style={at(2)}>
                {text}
            </p>
            {extra}
            <div className="hg-status__acts hg-enter" style={at(4)}>
                {actions}
            </div>
            {footer}
        </section>
    )
    return wrap ? <div className="hg-status-wrap">{card}</div> : card
}

export { at as statusDelay }

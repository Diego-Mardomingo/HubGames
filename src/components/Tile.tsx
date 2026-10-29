import type { CSSProperties, ReactNode } from 'react'
import '@/styles/lists.css'

/**
 * Baldosa de una cifra (`.hg-tile` en styles/lists.css): icono tintado con el color de lo que cuenta (`tone`, una clase
 * `st-*`, `sc-*`…), etiqueta y, como hijos, los `<dd>` con el valor (`.hg-tile__value`) y la nota (`.hg-tile__note`).
 * Va dentro de un `<dl className="hg-tiles">`. `className` y `style` para la entrada (`.hg-enter`, `--i`) o un borde propio.
 */
export default function Tile({
    icon,
    tone,
    label,
    children,
    className,
    style,
}: {
    icon: ReactNode
    tone: string
    label: string
    children: ReactNode
    className?: string
    style?: CSSProperties
}) {
    return (
        <div className={['hg-tile', tone, className].filter(Boolean).join(' ')} style={style}>
            <dt>
                <span className="hg-tile__icon hg-tint">{icon}</span>
                {label}
            </dt>
            {children}
        </div>
    )
}

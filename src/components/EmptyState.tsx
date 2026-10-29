import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import '@/styles/lists.css'

/**
 * Estado vacío (`.hg-empty` en lists.css): icono con el color de su lista o sección, título corto sin punto, una frase
 * y una acción.
 *
 * - `tone`: clase de color del icono. La de la lista o sección (`st-*`, `dash-*`…); `st-todos` (cobalto) si la sección
 *   no tiene color propio (wishlist, JUDI, ranking, iniciar sesión, Steam); `neutral` si el vacío lo provoca un filtro
 *   o una búsqueda. Rojo y ámbar quedan para errores y avisos.
 * - `size`: `section` (icono a la izquierda, dentro de una página con más cosas) o `page` (centrado, cuando la página o
 *   su lista principal entera está vacía).
 * - `bare`: sin marco, cuando ya va dentro de un panel.
 *
 * Entra con un fundido y el icono hace pop; al cambiar de lista o de filtro, se monta otra vez (con `key`) y vuelve a
 * entrar. Con movimiento reducido, aparece sin moverse.
 */
export default function EmptyState({
    tone,
    icon,
    title,
    children,
    action,
    size = 'section',
    bare = false,
    role,
    className,
    style,
}: {
    tone: string
    icon: ReactNode
    title: string
    children?: ReactNode
    action?: ReactNode
    size?: 'section' | 'page'
    bare?: boolean
    role?: 'alert' | 'status'
    className?: string
    style?: CSSProperties
}) {
    return (
        <div className={cn('hg-empty', size === 'page' && 'hg-empty--page', bare && 'hg-empty--bare', className)} role={role} style={style}>
            <span className={cn('hg-empty__icon hg-tint', tone)} aria-hidden>
                {icon}
            </span>
            <p className="hg-empty__body">
                <b className="hg-empty__title">{title}</b>
                {children}
            </p>
            {action && <div className="hg-empty__acts">{action}</div>}
        </div>
    )
}

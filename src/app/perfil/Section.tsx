import type { CSSProperties, ReactNode } from 'react'

export type Notify = (kind: 'ok' | 'error', text: string) => void

/** Posición en la entrada escalonada (`.hg-enter`, 30 ms entre bloques). */
export const enter = (i: number) => ({ '--i': i }) as CSSProperties

/**
 * Sección del perfil: panel con la cabecera del Inicio (`.dash-sec__head`, icono tintado con el color de lo que es) y filas.
 * `tone`: clase de color (`st-todos`, `dash-ok`, `dash-warn`, `dash-ko`, `dash-leg`, `neutral`…).
 */
export function PfSection({
    id,
    tone,
    icon,
    title,
    end,
    className,
    style,
    children,
}: {
    id: string
    tone: string
    icon: ReactNode
    title: string
    end?: ReactNode
    className?: string
    style?: CSSProperties
    children: ReactNode
}) {
    return (
        <section className={['pf-sec hg-enter', className].filter(Boolean).join(' ')} style={style} aria-labelledby={id}>
            <header className="dash-sec__head pf-sec__head">
                <span className={`dash-sec__icon hg-tint ${tone}`} aria-hidden>
                    {icon}
                </span>
                <h2 id={id} className="dash-sec__title">
                    {title}
                </h2>
                {end && <span className="dash-sec__end">{end}</span>}
            </header>
            {children}
        </section>
    )
}

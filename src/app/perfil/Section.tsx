import type { CSSProperties, ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'

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

export type SaveState = 'idle' | 'saving' | 'done'

/** Botón que guarda: spinner mientras guarda y luego un check que se dibuja (`.hg-draw`) con `done` en verde. */
export function SaveButton({ state, done, children, disabled, className, ...props }: ButtonProps & { state: SaveState; done: string }) {
    return (
        <Button
            {...props}
            loading={state === 'saving'}
            disabled={disabled || state !== 'idle'}
            className={[className, state === 'done' && 'is-done'].filter(Boolean).join(' ')}
        >
            {state === 'done' ? (
                <>
                    <Check className="hg-draw" data-icon="inline-start" aria-hidden />
                    {done}
                </>
            ) : (
                children
            )}
        </Button>
    )
}

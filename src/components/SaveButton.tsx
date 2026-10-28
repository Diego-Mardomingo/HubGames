import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'

export type SaveState = 'idle' | 'saving' | 'done'

/**
 * Botón que guarda (o entra): spinner mientras trabaja y luego un check que se dibuja (`.hg-draw`) con `done`;
 * `.is-done` lo pone en verde (sólido si es el primario). El texto entra con un fundido al cambiar de estado.
 * `saving`: texto mientras trabaja («Entrando…»); si no se da, se queda el de reposo.
 * Perfil (Cuenta) y login.
 */
export function SaveButton({
    state,
    done,
    saving,
    children,
    disabled,
    className,
    ...props
}: ButtonProps & { state: SaveState; done: string; saving?: ReactNode }) {
    const content =
        state === 'done' ? (
            <>
                <Check className="hg-draw" data-icon="inline-start" aria-hidden />
                {done}
            </>
        ) : state === 'saving' && saving ? (
            saving
        ) : (
            children
        )
    return (
        <Button
            {...props}
            loading={state === 'saving'}
            disabled={disabled || state !== 'idle'}
            className={[className, state === 'done' && 'is-done'].filter(Boolean).join(' ')}
        >
            <span key={state} className="hg-button__swap">
                {content}
            </span>
        </Button>
    )
}

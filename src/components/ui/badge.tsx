import * as React from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'muted' | 'success' | 'danger'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: BadgeVariant | null
}

/** Etiqueta de estado plana. Estilos en styles/ui.css (las utilidades de Tailwind con escala no se generan). */
function Badge({ className, variant, ...props }: BadgeProps) {
    return <div className={cn('hg-badge', `hg-badge--${variant ?? 'default'}`, className)} {...props} />
}

export { Badge }

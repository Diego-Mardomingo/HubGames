import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Botón estilo shadcn/ui (CVA + Radix Slot).
 * Un solo componente para toda la app: `import { Button } from '@/components/ui/button'`.
 *
 * Iconos: `data-icon="inline-start"` | `inline-end` en Lucide/SVG o `<i className="fa-..." />`.
 * Espacio icono–texto: clase `.hg-button` en globals.css (`column-gap`; las utilidades `gap-*` no se emitían en el bundle).
 */
const buttonVariants = cva(
    [
        'hg-button inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius)] text-sm font-semibold',
        /* Lucide / SVG */
        '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
        /* Font Awesome */
        '[&_i]:pointer-events-none [&_i]:shrink-0 [&_i]:inline-flex [&_i]:items-center [&_i]:justify-center [&_i]:text-base [&_i]:leading-none',
        'transition-[filter,box-shadow,transform,color,background-color,border-color] duration-150 ease-out',
        'outline-none focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2 focus-visible:outline-offset-[var(--background)]',
        'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
    ].join(' '),
    {
        variants: {
            variant: {
                default: 'hg-btn--primary',
                secondary: 'hg-btn--secondary',
                ghost: 'border border-transparent text-[var(--foreground)] shadow-none hover:bg-[var(--surface-2)]',
                outline:
                    'border border-[var(--border)] bg-[var(--surface)]/80 text-[var(--foreground)] shadow-none hover:bg-[var(--surface-2)] hover:border-[var(--border-hover)]',
                danger: 'hg-btn--danger',
            },
            size: {
                sm: 'hg-button--sm h-8 px-3 text-xs [&_svg]:size-3.5 [&_i]:text-sm',
                default: 'h-10 px-4',
                lg: 'hg-button--lg h-11 px-6 text-base',
                icon: 'hg-button--icon-only h-10 w-10 p-0 [&_svg]:size-[1.125rem] [&_i]:text-base',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button'
        return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    }
)
Button.displayName = 'Button'

export { Button, buttonVariants }

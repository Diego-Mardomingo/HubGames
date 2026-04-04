import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
    {
        variants: {
            variant: {
                default: 'border-[var(--primary)]/50 bg-[var(--primary)]/15 text-[var(--primary)]',
                muted: 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]',
                success: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300',
                danger: 'border-rose-400/40 bg-rose-500/10 text-rose-300',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
    return (
        <input
            ref={ref}
            className={cn(
                'h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-[1.125rem] py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                className
            )}
            {...props}
        />
    )
})
Input.displayName = 'Input'

export { Input }

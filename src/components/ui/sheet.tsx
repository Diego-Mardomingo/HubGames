import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close

const SheetPortal = DialogPrimitive.Portal

const SheetOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay ref={ref} className={cn('fixed inset-0 z-50 bg-black/70', className)} {...props} />
))
SheetOverlay.displayName = 'SheetOverlay'

const SheetTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn('text-lg font-semibold leading-none tracking-tight text-[var(--foreground)]', className)}
        {...props}
    />
))
SheetTitle.displayName = DialogPrimitive.Title.displayName

const SheetContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: 'left' | 'right' }
>(({ className, children, side = 'right', ...props }, ref) => (
    <SheetPortal>
        <SheetOverlay />
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                'fixed z-50 h-full w-[92%] max-w-md border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]',
                side === 'right' ? 'right-0 top-0 rounded-l-[var(--radius-lg)]' : 'left-0 top-0 rounded-r-[var(--radius-lg)]',
                className
            )}
            {...props}
        >
            {children}
            <SheetClose className="absolute right-4 top-4 rounded-[var(--radius-sm)] opacity-70 hover:opacity-100">
                <X className="h-4 w-4" />
            </SheetClose>
        </DialogPrimitive.Content>
    </SheetPortal>
))
SheetContent.displayName = 'SheetContent'

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle }

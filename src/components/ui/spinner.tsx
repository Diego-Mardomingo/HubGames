import { Loader2, type LucideProps } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Icono girando: "esto se está guardando". Va donde iba el icono del control, para que no salte nada de sitio. */
export function Spinner({ className, ...props }: LucideProps) {
    return <Loader2 className={cn('hg-spin', className)} aria-hidden {...props} />
}

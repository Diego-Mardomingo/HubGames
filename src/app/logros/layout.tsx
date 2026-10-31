import type { Metadata } from 'next'
import { PRIVATE_ROBOTS } from '@/lib/seo'

export const metadata: Metadata = {
    title: 'Logros',
    description: 'Caza de logros: juegos cerca del 100 %, logros fáciles que te faltan, olvidados y tus logros más raros.',
    robots: PRIVATE_ROBOTS,
}

export default function LogrosLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}

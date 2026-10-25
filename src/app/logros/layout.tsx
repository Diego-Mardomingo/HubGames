import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Logros',
    description: 'Caza de logros: juegos cerca del 100 %, logros fáciles que te faltan, olvidados y tus logros más raros.',
}

export default function LogrosLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}

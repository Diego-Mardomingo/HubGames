import type { Metadata } from 'next'
import { PRIVATE_ROBOTS } from '@/lib/seo'

export const metadata: Metadata = {
    title: 'Wishlist',
    description: 'Tu wishlist de Steam con el precio actual, el descuento y el mínimo histórico.',
    robots: PRIVATE_ROBOTS,
}

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}

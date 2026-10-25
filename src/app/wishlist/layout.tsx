import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Wishlist',
    description: 'Tu wishlist de Steam con el precio actual, el descuento y el mínimo histórico.',
}

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}

'use client'

import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { openGameSearch } from '@/components/tracker/GameSearch'

/** «Buscar un juego»: abre el buscador global (Ctrl + K) desde un estado vacío del Inicio. */
export default function OpenSearchButton({ size, variant = 'secondary' }: { size?: 'sm' | 'default'; variant?: 'secondary' | 'default' }) {
    return (
        <Button type="button" size={size} variant={variant} onClick={openGameSearch}>
            <Search aria-hidden /> Buscar un juego
        </Button>
    )
}

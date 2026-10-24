import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export interface SteamSearchResult {
    appid: number
    name: string
    image: string | null
    /** Precio final en euros ya formateado, "Gratis" o null si no está a la venta. */
    price: string | null
    discount: number | null
}

interface StoreSearchItem {
    type?: string
    id?: number
    name?: string
    tiny_image?: string
    price?: { currency?: string; initial?: number; final?: number }
}

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

/** Buscador de juegos (#20): proxy a la búsqueda de la tienda de Steam. Solo con sesión; se cachea una hora por término. */
export async function GET(request: NextRequest) {
    const supabase = await createServerClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const term = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 100)
    if (term.length < 2) return NextResponse.json({ results: [] })

    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=spanish&cc=ES`
    try {
        const res = await fetch(url, { next: { revalidate: 3600 } })
        if (!res.ok) throw new Error(`storesearch: ${res.status}`)
        const items: StoreSearchItem[] = (await res.json())?.items ?? []
        const results: SteamSearchResult[] = items
            .filter((i) => i.type === 'app' && typeof i.id === 'number' && i.name)
            .map((i) => {
                const final = i.price?.final
                const initial = i.price?.initial
                return {
                    appid: i.id!,
                    name: i.name!,
                    image: i.tiny_image ?? null,
                    price: final === undefined ? null : final === 0 ? 'Gratis' : EUR.format(final / 100),
                    discount: final !== undefined && initial && final < initial ? Math.round((1 - final / initial) * 100) : null,
                }
            })
        return NextResponse.json({ results })
    } catch (e) {
        console.error('steam/search', e)
        return NextResponse.json({ error: 'La tienda de Steam no responde' }, { status: 502 })
    }
}

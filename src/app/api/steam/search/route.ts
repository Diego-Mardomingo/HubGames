import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { parseStoreSearch, type StoreSearchItem } from '@/lib/game-search'

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
        return NextResponse.json({ results: parseStoreSearch(items) })
    } catch (e) {
        console.error('steam/search', e)
        return NextResponse.json({ error: 'La tienda de Steam no responde' }, { status: 502 })
    }
}

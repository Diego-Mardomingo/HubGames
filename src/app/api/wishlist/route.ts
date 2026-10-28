import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseAppid } from '@/lib/catalog'
import { fetchStoreCatalogRow } from '@/lib/steam-sync'
import { refreshPrices } from '@/lib/prices'

async function currentUser() {
    const supabase = await createServerClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    return user
}

/** "Añadir a la wishlist" (#35) desde el buscador o la ficha. Trae la ficha si falta y el precio y el mínimo al momento. */
export async function POST(request: NextRequest) {
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const appid = parseAppid(String(body?.appid ?? ''))
    if (!appid) return NextResponse.json({ error: 'appid no válido' }, { status: 400 })

    const admin = createAdminClient()
    const { data: owned } = await admin
        .from('hubgames_user_steam_games')
        .select('appid')
        .eq('user_id', user.id)
        .eq('appid', appid)
        .maybeSingle()
    if (owned) return NextResponse.json({ error: 'Ya lo tienes en tu biblioteca de Steam' }, { status: 409 })

    // Sin ficha en la tienda no se acepta: así no se llena el catálogo con appids inventados.
    const { data: inCatalog } = await admin.from('hubgames_juegos_steam').select('steam_appid').eq('steam_appid', appid).maybeSingle()
    if (!inCatalog) {
        const row = await fetchStoreCatalogRow(appid, false).catch(() => null)
        if (!row) return NextResponse.json({ error: 'Steam no tiene ese juego' }, { status: 404 })
        const { error } = await admin.from('hubgames_juegos_steam').upsert(row, { onConflict: 'steam_appid' })
        if (error) return NextResponse.json({ error: 'No se pudo guardar la ficha' }, { status: 500 })
    }

    // Deshacer en /wishlist: vuelve con su fecha de alta de antes (solo una fecha válida que no sea futura).
    const restoredAt = typeof body?.restore?.date_added === 'string' ? Date.parse(body.restore.date_added) : NaN
    const restore = Number.isFinite(restoredAt) && restoredAt <= Date.now() ? new Date(restoredAt).toISOString() : null

    // Si ya estaba (por ejemplo, desde Steam) se deja como estaba.
    const { error } = await admin
        .from('hubgames_user_wishlist')
        .upsert(
            { user_id: user.id, appid, source: 'manual', ...(restore ? { date_added: restore } : {}) },
            { onConflict: 'user_id,appid', ignoreDuplicates: true },
        )
    if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
    // Al deshacer, el precio sigue guardado: no hace falta pedirlo otra vez.
    if (restore) return NextResponse.json({ ok: true })

    // El precio no es imprescindible: si falla, llegará con la sincronización diaria.
    await refreshPrices(admin, [appid]).catch((e) => console.error('wishlist: precios', appid, e))
    return NextResponse.json({ ok: true })
}

/** Quita un juego añadido desde HubGames. Los de Steam volverían en la siguiente sincronización: se quitan en Steam. */
export async function DELETE(request: NextRequest) {
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const appid = parseAppid(request.nextUrl.searchParams.get('appid') ?? '')
    if (!appid) return NextResponse.json({ error: 'appid no válido' }, { status: 400 })

    const admin = createAdminClient()
    const { data: row } = await admin
        .from('hubgames_user_wishlist')
        .select('source')
        .eq('user_id', user.id)
        .eq('appid', appid)
        .maybeSingle()
    if (!row) return NextResponse.json({ ok: true })
    if (row.source === 'steam') {
        return NextResponse.json({ error: 'Está en tu wishlist de Steam: quítalo allí y desaparecerá en la próxima sincronización' }, { status: 409 })
    }
    const { error } = await admin.from('hubgames_user_wishlist').delete().eq('user_id', user.id).eq('appid', appid)
    if (error) return NextResponse.json({ error: 'No se pudo quitar' }, { status: 500 })
    return NextResponse.json({ ok: true })
}

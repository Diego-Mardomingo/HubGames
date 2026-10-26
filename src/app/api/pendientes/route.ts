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

/** "Añadir a Pendientes" un juego que no tienes, desde el buscador o la ficha. Trae la ficha si falta y el precio y el mínimo. */
export async function POST(request: NextRequest) {
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const appid = parseAppid(String(body?.appid ?? ''))
    if (!appid) return NextResponse.json({ error: 'appid no válido' }, { status: 400 })

    const admin = createAdminClient()
    // Si ya lo sigues (lo tienes en Steam o ya estaba en Pendientes), se cambia desde su ficha, no aquí.
    const { data: tracked } = await admin
        .from('hubgames_user_games')
        .select('status')
        .eq('user_id', user.id)
        .eq('appid', appid)
        .maybeSingle()
    if (tracked) return NextResponse.json({ ok: true, status: tracked.status })

    // Sin ficha en la tienda no se acepta: así no se llena el catálogo con appids inventados.
    const { data: inCatalog } = await admin.from('hubgames_juegos_steam').select('steam_appid').eq('steam_appid', appid).maybeSingle()
    if (!inCatalog) {
        const row = await fetchStoreCatalogRow(appid, false).catch(() => null)
        if (!row) return NextResponse.json({ error: 'Steam no tiene ese juego' }, { status: 404 })
        const { error } = await admin.from('hubgames_juegos_steam').upsert(row, { onConflict: 'steam_appid' })
        if (error) return NextResponse.json({ error: 'No se pudo guardar la ficha' }, { status: 500 })
    }

    const { error } = await admin
        .from('hubgames_user_games')
        .upsert({ user_id: user.id, appid, status: 'pendiente', status_source: 'manual' }, { onConflict: 'user_id,appid', ignoreDuplicates: true })
    if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })

    // El precio no es imprescindible: si falla, llegará con la sincronización diaria.
    await refreshPrices(admin, [appid]).catch((e) => console.error('pendientes: precios', appid, e))
    return NextResponse.json({ ok: true, status: 'pendiente' })
}

/** Quita de Pendientes un juego que no tienes. Uno de tu biblioteca de Steam no se borra: se cambia de estado. */
export async function DELETE(request: NextRequest) {
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const appid = parseAppid(request.nextUrl.searchParams.get('appid') ?? '')
    if (!appid) return NextResponse.json({ error: 'appid no válido' }, { status: 400 })

    const admin = createAdminClient()
    const { data: owned } = await admin
        .from('hubgames_user_steam_games')
        .select('appid')
        .eq('user_id', user.id)
        .eq('appid', appid)
        .maybeSingle()
    if (owned) return NextResponse.json({ error: 'Lo tienes en Steam: cambia su estado en lugar de quitarlo' }, { status: 409 })

    const { error } = await admin.from('hubgames_user_games').delete().eq('user_id', user.id).eq('appid', appid)
    if (error) return NextResponse.json({ error: 'No se pudo quitar' }, { status: 500 })
    return NextResponse.json({ ok: true })
}

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseAppid } from '@/lib/catalog'
import { fetchStoreCatalogRow } from '@/lib/steam-sync'
import { refreshPrices } from '@/lib/prices'
import { canMarkBacklog } from '@/lib/library'
import type { GameStatus } from '@/lib/tracker'

async function currentUser() {
    const supabase = await createServerClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    return user
}

/** "Añadir a Pendientes" un juego que no tienes (o que ya sigues, conservando su estado), desde el buscador o la ficha. Trae la ficha si falta y el precio y el mínimo. */
export async function POST(request: NextRequest) {
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const appid = parseAppid(String(body?.appid ?? ''))
    if (!appid) return NextResponse.json({ error: 'appid no válido' }, { status: 400 })

    const admin = createAdminClient()
    // Si ya lo sigues, no se le cambia el estado: se añade a Pendientes con el suyo (#140). Los que no admiten la marca
    // (Pendiente, Jugando, Descartado) se quedan como están y se cambian desde su ficha.
    const { data: tracked } = await admin
        .from('hubgames_user_games')
        .select('status, in_backlog')
        .eq('user_id', user.id)
        .eq('appid', appid)
        .maybeSingle()
    if (tracked) {
        const markable = canMarkBacklog(tracked.status as GameStatus)
        if (markable && !tracked.in_backlog) {
            const { error } = await admin
                .from('hubgames_user_games')
                .update({ in_backlog: true, backlog_position: null })
                .eq('user_id', user.id)
                .eq('appid', appid)
            if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
        }
        return NextResponse.json({ ok: true, status: tracked.status, in_backlog: markable })
    }

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

/** Quita de Pendientes un juego que no tienes, o la marca de uno añadido con su estado. Uno de tu biblioteca de Steam no se borra: se cambia de estado. */
export async function DELETE(request: NextRequest) {
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const appid = parseAppid(request.nextUrl.searchParams.get('appid') ?? '')
    if (!appid) return NextResponse.json({ error: 'appid no válido' }, { status: 400 })

    const admin = createAdminClient()
    // Añadido con su estado (#140): se quita la marca y conserva su estado (y su historial).
    const { data: tracked } = await admin
        .from('hubgames_user_games')
        .select('status, in_backlog')
        .eq('user_id', user.id)
        .eq('appid', appid)
        .maybeSingle()
    if (tracked?.in_backlog && tracked.status !== 'pendiente') {
        const { error } = await admin.from('hubgames_user_games').update({ in_backlog: false }).eq('user_id', user.id).eq('appid', appid)
        if (error) return NextResponse.json({ error: 'No se pudo quitar' }, { status: 500 })
        return NextResponse.json({ ok: true })
    }

    const { data: owned } = await admin
        .from('hubgames_user_steam_games')
        .select('appid')
        .eq('user_id', user.id)
        .eq('appid', appid)
        .is('family_gone_at', null)
        .maybeSingle()
    // Los que ya no están en el grupo familiar (#86) sí se pueden quitar.
    if (owned) return NextResponse.json({ error: 'Lo tienes en Steam: cambia su estado en lugar de quitarlo' }, { status: 409 })

    const { error } = await admin.from('hubgames_user_games').delete().eq('user_id', user.id).eq('appid', appid)
    if (error) return NextResponse.json({ error: 'No se pudo quitar' }, { status: 500 })
    return NextResponse.json({ ok: true })
}

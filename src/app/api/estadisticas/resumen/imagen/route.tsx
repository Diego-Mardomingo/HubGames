import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { loadStatsInput } from '@/lib/stats-db'
import { availableYears, madridYear } from '@/lib/stats'
import { buildWrappedView } from '@/lib/wrapped'
import { wrappedImage } from './wrapped-image'

/** Imagen para compartir del resumen anual (#33), 1200×630. Solo con sesión: son tus datos. */
export async function GET(request: NextRequest) {
    const supabase = await createServerClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const input = await loadStatsInput(supabase, user.id)
    const requested = Number(request.nextUrl.searchParams.get('year'))
    const year = availableYears(input).includes(requested) ? requested : madridYear(new Date().toISOString())
    return wrappedImage(buildWrappedView(input, year), { 'Cache-Control': 'private, max-age=300' })
}

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Variante reducida del CDN de Steam: las capturas se guardan como `ss_<hash>.1920x1080.jpg` y existe `.600x338.jpg`. */
function smallVariant(url: string): string | null {
    const small = url.replace(/\.\d+x\d+\.jpg/, '.600x338.jpg')
    return small === url ? null : small
}

/**
 * Captura de un JUDI por fase (#39). Las URLs del CDN de Steam llevan el appid del juego, así que el navegador no las
 * ve: este proxy las resuelve con la service role y devuelve la imagen. La función solo responde a días ya publicados.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; phase: string }> }) {
    const { id: rawId, phase: rawPhase } = await params
    const id = Number(rawId)
    const phase = Number(rawPhase)
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(phase) || phase < 1 || phase > 6) {
        return NextResponse.json({ error: 'Parámetros no válidos' }, { status: 400 })
    }

    const { data: url, error } = await createAdminClient().rpc('hubgames_judi_capture_url', { p_id: id, p_phase: phase })
    if (error) return NextResponse.json({ error: 'No se pudo leer la captura' }, { status: 500 })
    if (!url) return NextResponse.json({ error: 'No existe' }, { status: 404 })

    // ?s=sm: miniaturas y portadas. Si Steam no tiene la variante reducida, se sirve la original.
    const small = request.nextUrl.searchParams.get('s') === 'sm' ? smallVariant(url) : null
    let upstream = small ? await fetch(small, { cache: 'no-store' }).catch(() => null) : null
    if (!upstream?.ok || !upstream.body) upstream = await fetch(url, { cache: 'no-store' }).catch(() => null)
    if (!upstream?.ok || !upstream.body) return NextResponse.json({ error: 'Steam no ha devuelto la imagen' }, { status: 502 })

    return new Response(upstream.body, {
        headers: {
            'Content-Type': upstream.headers.get('content-type') ?? 'image/jpeg',
            // La captura de un día y fase no cambia: que la sirva la caché del navegador y de Vercel.
            'Cache-Control': 'public, max-age=86400, s-maxage=2592000, immutable',
        },
    })
}

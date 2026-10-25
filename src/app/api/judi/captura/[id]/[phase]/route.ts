import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Captura de un JUDI por fase (#39). Las URLs del CDN de Steam llevan el appid del juego, así que el navegador no las
 * ve: este proxy las resuelve con la service role y devuelve la imagen. La función solo responde a días ya publicados.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; phase: string }> }) {
    const { id: rawId, phase: rawPhase } = await params
    const id = Number(rawId)
    const phase = Number(rawPhase)
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(phase) || phase < 1 || phase > 6) {
        return NextResponse.json({ error: 'Parámetros no válidos' }, { status: 400 })
    }

    const { data: url, error } = await createAdminClient().rpc('hubgames_judi_capture_url', { p_id: id, p_phase: phase })
    if (error) return NextResponse.json({ error: 'No se pudo leer la captura' }, { status: 500 })
    if (!url) return NextResponse.json({ error: 'No existe' }, { status: 404 })

    const upstream = await fetch(url, { cache: 'no-store' }).catch(() => null)
    if (!upstream?.ok || !upstream.body) return NextResponse.json({ error: 'Steam no ha devuelto la imagen' }, { status: 502 })

    return new Response(upstream.body, {
        headers: {
            'Content-Type': upstream.headers.get('content-type') ?? 'image/jpeg',
            // La captura de un día y fase no cambia: que la sirva la caché del navegador y de Vercel.
            'Cache-Control': 'public, max-age=86400, s-maxage=2592000, immutable',
        },
    })
}

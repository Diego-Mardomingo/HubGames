import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { LibraryGame } from '@/lib/tracker'
import {
    ACHIEVEMENT_COLUMNS,
    EXPORT_KINDS,
    LIBRARY_COLUMNS,
    achievementRows,
    exportFileName,
    libraryRows,
    toCsv,
    type ExportKind,
} from '@/lib/export'

type Client = Awaited<ReturnType<typeof createServerClient>>

async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
    const out: T[] = []
    for (let from = 0; ; from += 1000) {
        const { data, error } = await page(from, from + 999)
        if (error) throw new Error(error.message)
        out.push(...(data ?? []))
        if (!data || data.length < 1000) return out
    }
}

async function loadLibrary(supabase: Client, userId: string) {
    const games = await all((from, to) => supabase.from('hubgames_library').select('*').eq('user_id', userId).order('appid').range(from, to))
    return games as LibraryGame[]
}

async function loadAchievements(supabase: Client, userId: string, games: LibraryGame[]) {
    const names = new Map(games.map((g) => [g.appid, g.name]))
    const rows = await all((from, to) =>
        supabase
            .from('hubgames_achievements')
            .select('appid, apiname, display_name, unlocktime, global_percent')
            .eq('user_id', userId)
            .eq('achieved', true)
            .order('appid')
            .order('apiname')
            .range(from, to),
    )
    return achievementRows(
        rows.flatMap((a) =>
            a.appid !== null && a.apiname !== null
                ? [
                      {
                          appid: a.appid,
                          game: names.get(a.appid) ?? null,
                          apiname: a.apiname,
                          display_name: a.display_name,
                          unlocktime: a.unlocktime,
                          global_percent: a.global_percent === null ? null : Number(a.global_percent),
                      },
                  ]
                : [],
        ),
    )
}

function download(body: string, kind: ExportKind, format: 'csv' | 'json') {
    return new NextResponse(body, {
        headers: {
            'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="${exportFileName(kind, format)}"`,
            'Cache-Control': 'no-store',
        },
    })
}

/**
 * Exportar tus datos (#34). `?tipo=biblioteca|logros` en CSV; `?tipo=todo` en JSON (biblioteca, logros e historial de
 * horas). Solo lo tuyo: va con tu sesión y la RLS.
 */
export async function GET(request: NextRequest) {
    const supabase = await createServerClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const kind = request.nextUrl.searchParams.get('tipo') as ExportKind | null
    if (!kind || !EXPORT_KINDS.includes(kind)) return NextResponse.json({ error: 'Tipo no válido' }, { status: 400 })

    try {
        const games = await loadLibrary(supabase, user.id)
        if (kind === 'biblioteca') return download(toCsv(libraryRows(games), LIBRARY_COLUMNS), kind, 'csv')
        const achievements = await loadAchievements(supabase, user.id, games)
        if (kind === 'logros') {
            return download(toCsv(achievements, [...ACHIEVEMENT_COLUMNS]), kind, 'csv')
        }
        const playtime = await all((from, to) =>
            supabase.from('hubgames_playtime_daily').select('appid, date, minutes').eq('user_id', user.id).order('date').order('appid').range(from, to),
        )
        const body = {
            exportado: new Date().toISOString(),
            biblioteca: libraryRows(games),
            logros: achievements,
            historial_horas: playtime,
        }
        return download(JSON.stringify(body, null, 2), kind, 'json')
    } catch (e) {
        console.error('export', e)
        return NextResponse.json({ error: 'No se pudieron exportar los datos' }, { status: 500 })
    }
}

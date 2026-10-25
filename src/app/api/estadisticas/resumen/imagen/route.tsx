import { ImageResponse } from 'next/og'
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { loadStatsInput } from '@/lib/stats-db'
import { availableYears, buildWrapped, madridYear, yearStats } from '@/lib/stats'
import { formatPercent } from '@/lib/achievements'

const NUMBER = new Intl.NumberFormat('es-ES')

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', padding: '18px 24px', borderRadius: 18, background: 'rgba(255,255,255,0.06)', minWidth: 190 }}>
            <span style={{ fontSize: 20, color: '#b3b0cc' }}>{label}</span>
            <span style={{ fontSize: 46, fontWeight: 700, color: '#eceaf6' }}>{value}</span>
        </div>
    )
}

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
    const w = buildWrapped(yearStats(input, year), input.games)
    const best = w.top[0]
    const hours = `${w.hoursMeasured ? '' : '≈ '}${NUMBER.format(Math.round(w.minutes / 60))} h`

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    position: 'relative',
                    background: '#07070c',
                    color: '#eceaf6',
                    fontFamily: 'sans-serif',
                }}
            >
                {best?.header_image && (
                    // eslint-disable-next-line @next/next/no-img-element -- Satori solo entiende <img>
                    <img
                        src={best.header_image}
                        alt=""
                        width={1200}
                        height={630}
                        style={{ position: 'absolute', inset: 0, width: 1200, height: 630, objectFit: 'cover', opacity: 0.28 }}
                    />
                )}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        background: 'linear-gradient(120deg, rgba(7,7,12,0.96) 35%, rgba(7,7,12,0.55) 100%)',
                    }}
                />
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 56, width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: 1 }}>
                            hub<span style={{ color: '#9a86ff' }}>games</span>
                        </span>
                        <span style={{ fontSize: 22, color: '#8e8ba8' }}>Mi resumen del año</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span
                            style={{
                                fontSize: 150,
                                fontWeight: 800,
                                lineHeight: 1,
                                letterSpacing: -6,
                                backgroundImage: 'linear-gradient(120deg, #b69cff 0%, #6f8bff 52%, #2ad4f0 100%)',
                                backgroundClip: 'text',
                                color: 'transparent',
                            }}
                        >
                            {String(year)}
                        </span>
                        {best && (
                            <span style={{ fontSize: 30, marginTop: 12, color: '#b3b0cc' }}>
                                Juego del año: <span style={{ color: '#eceaf6', fontWeight: 700, marginLeft: 10 }}>{best.name ?? `App ${best.appid}`}</span>
                            </span>
                        )}
                        {w.rarest && (
                            <span style={{ fontSize: 24, marginTop: 8, color: '#8e8ba8' }}>
                                Logro más raro: {w.rarest.display_name ?? 'Logro'} ({formatPercent(w.rarest.global_percent)})
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 16 }}>
                        <Stat label="Horas" value={hours} />
                        <Stat label="Logros" value={NUMBER.format(w.unlocks)} />
                        <Stat label="Completados" value={String(w.completed)} />
                        <Stat label="Mejor racha" value={`${w.streak.length} d`} />
                    </div>
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
            headers: { 'Cache-Control': 'private, max-age=300' },
        },
    )
}

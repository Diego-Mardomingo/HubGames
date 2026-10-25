import { BarChart3, Clock, Flag, Share2, Star, Trophy } from 'lucide-react'
import { G, cover } from '../data'
import { C, F, ease, lerp, nf, rise } from '../theme'
import { Card, Cover, Kicker, Pill } from '../ui/kit'

const MONTHS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const HOURS = [96, 120, 88, 140, 104, 160, 210, 182, 118, 122, 0, 0]
const PREV = [70, 90, 110, 80, 95, 100, 150, 140, 90, 85, 100, 130]

const GENRES: [string, number, string][] = [
    ['RPG', 34, '#9a86ff'],
    ['Acción', 26, '#6f8bff'],
    ['Indie', 22, '#2ad4f0'],
    ['Estrategia', 11, '#34d399'],
    ['Otros', 7, '#5b5875'],
]

export const StatsMock = ({ f }: { f: number }) => {
    const n = ease(f, 8, 50)
    const kpis = [
        { Icon: Flag, label: 'Completados', v: nf(Math.round(lerp(0, 38, n))), delta: '+9 vs 2025', color: C.success },
        { Icon: Clock, label: 'Horas', v: nf(Math.round(lerp(0, 1340, n))), delta: '+18 %', color: C.accent },
        { Icon: Trophy, label: 'Logros', v: nf(Math.round(lerp(0, 2311, n))), delta: '+412', color: C.gold },
        { Icon: Star, label: 'Nota media', v: nf(lerp(0, 8.4, n), 1), delta: '38 reseñas', color: C.primary },
    ]
    const max = 220
    return (
        <div style={{ padding: '26px 34px', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', ...rise(f, 0) }}>
                <div>
                    <Kicker icon={<BarChart3 size={13} />}>Tu año en juegos</Kicker>
                    <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 40, letterSpacing: '-0.03em', marginTop: 6 }}>Estadísticas 2026</div>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                    <Pill>2025</Pill>
                    <Pill active>2026</Pill>
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 18 }}>
                {kpis.map(({ Icon, label, v, delta, color }, i) => (
                    <Card key={label} style={{ padding: '16px 18px', ...rise(f, 4 + i * 4, 18, 24) }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.mutedLight, fontSize: 13, fontWeight: 600 }}>
                            <Icon size={15} color={color} /> {label}
                        </div>
                        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 38, letterSpacing: '-0.03em', marginTop: 4 }}>{v}</div>
                        <div style={{ fontSize: 13, color }}>{delta}</div>
                    </Card>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 16, marginTop: 16 }}>
                <Card style={{ padding: 20, ...rise(f, 20) }}>
                    <div style={{ display: 'flex', alignItems: 'center', fontFamily: F.display, fontWeight: 700, fontSize: 17 }}>
                        Horas por mes
                        <span style={{ flex: 1 }} />
                        <span style={{ fontFamily: F.body, fontWeight: 500, fontSize: 13, color: C.muted, display: 'flex', gap: 14 }}>
                            <span>
                                <span style={{ color: C.primary }}>■</span> 2026
                            </span>
                            <span>
                                <span style={{ color: '#3a3852' }}>■</span> 2025
                            </span>
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 290, marginTop: 16 }}>
                        {MONTHS.map((m, i) => {
                            const t = ease(f, 26 + i * 3, 30)
                            return (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: '100%' }}>
                                        <div style={{ width: 9, height: `${(PREV[i] / max) * 100 * t}%`, borderRadius: 4, background: '#2a2940' }} />
                                        <div style={{ width: 16, height: `${(HOURS[i] / max) * 100 * t}%`, borderRadius: 5, background: 'linear-gradient(180deg, #b69cff, #6f8bff)' }} />
                                    </div>
                                    <span style={{ fontSize: 12, color: C.muted, fontFamily: F.mono }}>{m}</span>
                                </div>
                            )
                        })}
                    </div>
                </Card>
                <Card style={{ padding: 20, ...rise(f, 28) }}>
                    <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 17 }}>Géneros</div>
                    <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', margin: '16px 0 14px' }}>
                        {GENRES.map(([g, p, c]) => (
                            <div key={g} style={{ width: `${p * ease(f, 34, 40)}%`, background: c }} />
                        ))}
                    </div>
                    {GENRES.map(([g, p, c], i) => (
                        <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, padding: '3px 0', ...rise(f, 40 + i * 3, 14, 10) }}>
                            <span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                            {g}
                            <span style={{ flex: 1 }} />
                            <span style={{ fontFamily: F.mono, color: C.mutedLight }}>{p} %</span>
                        </div>
                    ))}
                </Card>
            </div>
        </div>
    )
}

/** Tarjeta del resumen anual (estilo Wrapped) para compartir. */
export const WrappedCard = ({ f, width = 420 }: { f: number; width?: number }) => (
    <div
        style={{
            width,
            aspectRatio: '9 / 12.5',
            borderRadius: 28,
            padding: 32,
            fontFamily: F.body,
            color: '#fff',
            background: 'radial-gradient(circle at 20% 0%, #8b6dff 0%, transparent 55%), radial-gradient(circle at 100% 100%, #13b5d6 0%, transparent 55%), #14102a',
            border: '1px solid rgba(255,255,255,0.18)',
            boxShadow: '0 40px 100px -20px rgba(111,139,255,0.6)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
        }}
    >
        <div style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: '0.2em', opacity: 0.8 }}>RESUMEN ANUAL</div>
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: width * 0.15, lineHeight: 1, letterSpacing: '-0.04em', marginTop: 8 }}>Tu 2026</div>
        <div style={{ display: 'flex', gap: 14, marginTop: 24, alignItems: 'center', ...rise(f, 10) }}>
            <Cover src={cover(G.bg3)} style={{ width: width * 0.3, aspectRatio: '2 / 3', borderRadius: 12, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.6)' }} />
            <div>
                <div style={{ fontSize: 13, opacity: 0.75 }}>Tu juego del año</div>
                <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 22, lineHeight: 1.15 }}>Baldur&apos;s Gate 3</div>
                <div style={{ fontSize: 14, opacity: 0.85, marginTop: 4 }}>212 h · nota 10</div>
            </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 'auto' }}>
            {[
                ['38', 'completados'],
                ['1.340 h', 'jugadas'],
                ['2.311', 'logros'],
                ['11', 'al 100 %'],
            ].map(([v, l], i) => (
                <div key={l} style={rise(f, 16 + i * 4, 16, 16)}>
                    <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 30 }}>{v}</div>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>{l}</div>
                </div>
            ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22, fontSize: 14, fontWeight: 600, opacity: 0.9 }}>
            <Share2 size={15} /> hub-games.vercel.app
        </div>
    </div>
)

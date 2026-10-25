import { Bell, Heart, TrendingDown } from 'lucide-react'
import { G, header, type Game } from '../data'
import { C, F, ease, lerp, nf, pop, rise } from '../theme'
import { Badge, Card, Cover, Kicker, Pill } from '../ui/kit'
import { LogoMark } from '../ui/Logo'

type Row = { g: Game; from: number; to: number; low: number; anyLow: number; atl?: boolean; target?: string; points: number[] }

const ROWS: Row[] = [
    { g: G.eldenRing, from: 59.99, to: 23.99, low: 23.99, anyLow: 21.5, atl: true, points: [60, 60, 42, 60, 36, 60, 30, 48, 24] },
    { g: G.rdr2, from: 59.99, to: 19.79, low: 14.99, anyLow: 13.2, target: 'Objetivo: 15 €', points: [60, 40, 60, 30, 60, 24, 60, 15, 20] },
    { g: G.liesOfP, from: 49.99, to: 49.99, low: 24.99, anyLow: 22.4, target: 'Objetivo: −50 %', points: [50, 50, 35, 50, 25, 50, 50, 50, 50] },
    { g: G.itTakesTwo, from: 39.99, to: 9.99, low: 9.99, anyLow: 8.99, atl: true, points: [40, 40, 20, 40, 14, 40, 10, 40, 10] },
]

const Spark = ({ pts, t, color }: { pts: number[]; t: number; color: string }) => {
    const w = 150
    const h = 44
    const max = Math.max(...pts)
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * w},${h - (p / max) * (h - 4)}`).join(' ')
    return (
        <svg width={w} height={h} style={{ overflow: 'visible' }}>
            <path d={d} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} />
        </svg>
    )
}

export const WishlistMock = ({ f, notify = true }: { f: number; notify?: boolean }) => {
    const drop = ease(f, 40, 30)
    const push = pop(f, 84, 22)
    return (
        <div style={{ padding: '26px 34px', position: 'relative', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', ...rise(f, 0) }}>
                <div>
                    <Kicker icon={<Heart size={13} />}>Precios y avisos</Kicker>
                    <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 40, letterSpacing: '-0.03em', marginTop: 6 }}>Wishlist</div>
                    <div style={{ color: C.mutedLight, fontSize: 16 }}>14 juegos · 3 en su mínimo histórico</div>
                </div>
                <div style={{ flex: 1 }} />
                <Pill active>
                    <Bell size={14} /> Avisos activados
                </Pill>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
                {ROWS.map((r, i) => {
                    const t = i === 0 ? drop : 1
                    const price = lerp(r.from, r.to, t)
                    const disc = Math.round((1 - price / r.from) * 100)
                    const hit = i === 0 ? f > 68 : r.atl
                    return (
                        <Card
                            key={r.g.id}
                            glow={i === 0 && f > 68}
                            style={{ display: 'flex', alignItems: 'center', gap: 18, padding: 14, ...rise(f, 6 + i * 6, 20, 30) }}
                        >
                            <Cover src={header(r.g)} style={{ width: 200, height: 94, borderRadius: 10 }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 18 }}>{r.g.name}</div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                    {hit && (
                                        <Badge color={C.success} style={{ scale: i === 0 ? String(pop(f, 68, 16)) : undefined }}>
                                            <TrendingDown size={12} /> Mínimo histórico
                                        </Badge>
                                    )}
                                    {r.target && <Badge color={C.primary}>{r.target}</Badge>}
                                </div>
                            </div>
                            <Spark pts={r.points} t={ease(f, 16 + i * 6, 40)} color={hit ? C.success : C.primary} />
                            <div style={{ width: 210, fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
                                <div>
                                    Mín. Steam <span style={{ color: C.mutedLight, fontFamily: F.mono }}>{nf(r.low, 2)} €</span>
                                </div>
                                <div>
                                    Mín. en tiendas <span style={{ color: C.mutedLight, fontFamily: F.mono }}>{nf(r.anyLow, 2)} €</span>
                                </div>
                            </div>
                            <div style={{ width: 150, textAlign: 'right' }}>
                                {disc > 0 && (
                                    <Badge color={C.success} style={{ fontSize: 14 }}>
                                        −{disc} %
                                    </Badge>
                                )}
                                <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 26, marginTop: 4, color: hit ? C.success : C.fg }}>{nf(price, 2)} €</div>
                                {disc > 0 && <div style={{ color: C.muted, fontSize: 13, textDecoration: 'line-through' }}>{nf(r.from, 2)} €</div>}
                            </div>
                        </Card>
                    )
                })}
            </div>

            {notify && (
                <div
                    style={{
                        position: 'absolute',
                        right: 24,
                        top: 14,
                        width: 420,
                        display: 'flex',
                        gap: 12,
                        padding: 14,
                        borderRadius: 18,
                        background: 'rgba(36,35,52,0.92)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,255,255,0.14)',
                        boxShadow: '0 30px 60px -10px rgba(0,0,0,0.9)',
                        opacity: Math.min(1, push),
                        translate: `0 ${(1 - push) * -90}px`,
                    }}
                >
                    <LogoMark size={42} tile />
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', fontSize: 13, color: C.mutedLight }}>
                            <b style={{ color: C.fg }}>HubGames</b>
                            <span style={{ flex: 1 }} />
                            ahora
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>ELDEN RING está en su mínimo histórico</div>
                        <div style={{ fontSize: 14, color: C.mutedLight }}>23,99 € en Steam (−60 %). ¡Es el momento!</div>
                    </div>
                </div>
            )}
        </div>
    )
}

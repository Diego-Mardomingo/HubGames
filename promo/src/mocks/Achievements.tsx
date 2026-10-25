import { Award, Flag, Gem, Medal, Sparkles, Target, Trophy } from 'lucide-react'
import { G, header, type Game } from '../data'
import { C, F, ease, lerp, nf, pop, rise } from '../theme'
import { Badge, Bar, Card, Cover, Kicker } from '../ui/kit'

const TOP: [string, number][] = [
    ['Hollow Knight', 1184],
    ['Hades', 962],
    ['Celeste', 731],
    ['Sekiro: Shadows Die Twice', 655],
]

const MILESTONES: { label: string; date: string; done: boolean }[] = [
    { label: '2000 logros', date: '12 oct 2026', done: true },
    { label: '10 juegos al 100 %', date: '3 sept 2026', done: true },
    { label: 'Primer logro ultra raro', date: '18 jun 2026', done: true },
    { label: '2500 logros', date: '2311/2500', done: false },
]

const NEAR: { g: Game; have: number; of: number }[] = [
    { g: G.outerWilds, have: 29, of: 31 },
    { g: G.cyberpunk, have: 50, of: 57 },
    { g: G.deadCells, have: 104, of: 122 },
]

export const AchievementsMock = ({ f }: { f: number }) => {
    const score = ease(f, 10, 55)
    const toast = pop(f, 96, 22)
    return (
        <div style={{ padding: '26px 34px', position: 'relative', height: '100%' }}>
            <div style={rise(f, 0)}>
                <Kicker icon={<Award size={13} />}>Caza de logros</Kicker>
                <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 40, letterSpacing: '-0.03em', marginTop: 6 }}>Logros</div>
                <div style={{ color: C.mutedLight, fontSize: 16 }}>2.311 logros en 118 juegos, 11 al 100 %.</div>
            </div>
            <Card style={{ padding: 22, marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, ...rise(f, 6) }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: F.display, fontWeight: 700, fontSize: 18 }}>
                        <Sparkles size={18} /> Puntuación de cazador
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '6px 0 10px' }}>
                        <span
                            style={{
                                fontFamily: F.display,
                                fontWeight: 800,
                                fontSize: 64,
                                letterSpacing: '-0.04em',
                                background: C.grad,
                                WebkitBackgroundClip: 'text',
                                color: 'transparent',
                            }}
                        >
                            {nf(Math.round(lerp(0, 8420, score)))}
                        </span>
                        <span style={{ color: C.mutedLight, fontFamily: F.display, fontWeight: 600 }}>puntos</span>
                    </div>
                    {TOP.map(([name, pts], i) => (
                        <div key={name} style={{ display: 'flex', fontSize: 15, padding: '4px 0', ...rise(f, 24 + i * 5, 16, 14) }}>
                            <span>{name}</span>
                            <span style={{ flex: 1 }} />
                            <span style={{ fontFamily: F.mono, color: C.mutedLight }}>{nf(pts)} pts</span>
                        </div>
                    ))}
                </div>
                <div>
                    <Kicker>Hitos</Kicker>
                    {MILESTONES.map((m, i) => (
                        <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', fontSize: 15, ...rise(f, 28 + i * 6, 16, 14) }}>
                            <div
                                style={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: '50%',
                                    display: 'grid',
                                    placeItems: 'center',
                                    background: m.done ? 'rgba(252,211,77,0.15)' : 'rgba(255,255,255,0.05)',
                                    color: m.done ? C.gold : C.muted,
                                }}
                            >
                                {m.done ? <Trophy size={14} /> : <Flag size={14} />}
                            </div>
                            <span style={{ color: m.done ? C.fg : C.mutedLight }}>{m.label}</span>
                            <span style={{ flex: 1 }} />
                            <span style={{ fontFamily: F.mono, fontSize: 13, color: C.muted }}>{m.date}</span>
                        </div>
                    ))}
                </div>
            </Card>
            <Card style={{ padding: 20, marginTop: 16, ...rise(f, 40) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: F.display, fontWeight: 700, fontSize: 18, marginBottom: 12 }}>
                    <Target size={18} /> Cerca del 100 %
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                    {NEAR.map((n, i) => {
                        const t = ease(f, 50 + i * 6, 40)
                        return (
                            <div key={n.g.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 10, borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface }}>
                                <Cover src={header(n.g)} style={{ width: 92, height: 44, borderRadius: 8 }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', fontSize: 14, fontWeight: 700 }}>
                                        <span>{n.g.name}</span>
                                        <span style={{ flex: 1 }} />
                                        <span style={{ fontFamily: F.mono }}>
                                            {Math.round(lerp(0, n.have, t))}/{n.of}
                                        </span>
                                    </div>
                                    <div style={{ color: C.muted, fontSize: 12, margin: '2px 0 6px' }}>Te faltan {n.of - n.have} logros</div>
                                    <Bar value={(n.have / n.of) * t} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </Card>

            {/* Logro ultra raro desbloqueado */}
            <div
                style={{
                    position: 'absolute',
                    right: 34,
                    bottom: 30,
                    width: 440,
                    display: 'flex',
                    gap: 14,
                    alignItems: 'center',
                    padding: 16,
                    borderRadius: 16,
                    background: 'linear-gradient(120deg, rgba(60,45,10,0.97), rgba(22,19,34,0.97))',
                    border: '1px solid rgba(252,211,77,0.6)',
                    boxShadow: `0 0 ${60 * toast}px -6px rgba(252,211,77,0.55), 0 30px 60px -20px rgba(0,0,0,0.9)`,
                    opacity: Math.min(1, toast),
                    translate: `0 ${(1 - toast) * 40}px`,
                    scale: String(lerp(0.85, 1, toast)),
                }}
            >
                <div style={{ width: 56, height: 56, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'rgba(252,211,77,0.15)', color: C.gold }}>
                    <Gem size={30} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ color: C.gold, fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Logro desbloqueado</div>
                    <div style={{ fontWeight: 700, fontSize: 17 }}>Hijo de la Nada · Hollow Knight</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <Badge color={C.gold}>
                            <Medal size={12} /> Ultra raro · 0,9 %
                        </Badge>
                        <Badge color={C.accent}>+30 pts</Badge>
                    </div>
                </div>
            </div>
        </div>
    )
}

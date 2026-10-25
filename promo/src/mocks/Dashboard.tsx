import { CalendarDays, Clock, Gamepad2, Hourglass, LayoutGrid, Play, RefreshCw, Sparkles, Target } from 'lucide-react'
import { G, header, type Game } from '../data'
import { C, F, ease, lerp, nf, pop, rise } from '../theme'
import { Badge, Bar, Card, Cover, Kicker, Pill } from '../ui/kit'

const PLAYING: { g: Game; h: number; when: string; left: string; ach: [number, number] }[] = [
    { g: G.silksong, h: 31.5, when: 'ayer', left: 'Faltan ~9 h', ach: [24, 47] },
    { g: G.bg3, h: 88, when: 'hoy', left: 'Historia: 75 %', ach: [31, 54] },
    { g: G.balatro, h: 42, when: 'hace 2 días', left: 'Extras: 60 %', ach: [17, 30] },
]

export const DashboardMock = ({ f }: { f: number }) => {
    const goal = ease(f, 70, 40)
    return (
        <div style={{ padding: '26px 34px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', ...rise(f, 0) }}>
                <div>
                    <Kicker icon={<LayoutGrid size={13} />}>Centro de control</Kicker>
                    <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 40, letterSpacing: '-0.03em', marginTop: 6 }}>Hola, Alex</div>
                    <div style={{ color: C.mutedLight, fontSize: 16 }}>3 juegos en curso. ¿A cuál le das hoy?</div>
                </div>
                <div style={{ flex: 1 }} />
                <Pill>
                    <RefreshCw size={15} style={{ rotate: `${ease(f, 4, 40) * 360}deg` }} /> Sincronizado hace 2 min
                </Pill>
            </div>

            <Card style={{ padding: 20, ...rise(f, 6) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: F.display, fontWeight: 700, fontSize: 19, marginBottom: 14 }}>
                    <Gamepad2 size={19} /> Jugando ahora
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {PLAYING.map((p, i) => {
                        const s = 12 + i * 6
                        const fill = ease(f, s + 14, 40)
                        return (
                            <div
                                key={p.g.id}
                                style={{
                                    borderRadius: 14,
                                    overflow: 'hidden',
                                    border: `1px solid ${C.border}`,
                                    background: C.surface,
                                    ...rise(f, s, 22, 60),
                                }}
                            >
                                <div style={{ position: 'relative' }}>
                                    <Cover src={header(p.g)} style={{ width: '100%', aspectRatio: '616 / 270' }} />
                                    <Pill active style={{ position: 'absolute', right: 10, top: 10, padding: '5px 12px', fontSize: 13 }}>
                                        <Play size={13} /> Jugar
                                    </Pill>
                                </div>
                                <div style={{ padding: '12px 14px 14px' }}>
                                    <div style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.g.name}</div>
                                    <div style={{ display: 'flex', gap: 14, color: C.mutedLight, fontSize: 13, margin: '6px 0 10px' }}>
                                        <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                            <Clock size={13} /> {nf(lerp(0, p.h, fill), p.h % 1 ? 1 : 0)} h
                                        </span>
                                        <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                            <CalendarDays size={13} /> {p.when}
                                        </span>
                                        <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                            <Hourglass size={13} /> {p.left}
                                        </span>
                                    </div>
                                    <Bar value={(fill * p.ach[0]) / p.ach[1]} />
                                    <div style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>
                                        {Math.round(fill * p.ach[0])}/{p.ach[1]} logros
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 16 }}>
                <Card style={{ padding: 20, ...rise(f, 34) }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: F.display, fontWeight: 700, fontSize: 18 }}>
                        <Sparkles size={18} color={C.accent} /> ¿Qué juego hoy?
                    </div>
                    <div style={{ display: 'flex', gap: 8, margin: '14px 0' }}>
                        <Pill>30 min</Pill>
                        <Pill active={f > 52}>1 h</Pill>
                        <Pill>2 h o más</Pill>
                        <Pill active={f > 58}>Relajado</Pill>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            gap: 14,
                            alignItems: 'center',
                            padding: 10,
                            borderRadius: 12,
                            background: C.gradSoft,
                            border: '1px solid rgba(154,134,255,0.3)',
                            opacity: pop(f, 64),
                            scale: String(lerp(0.9, 1, pop(f, 64))),
                        }}
                    >
                        <Cover src={header(G.stardew)} style={{ width: 120, height: 58, borderRadius: 8 }} />
                        <div>
                            <div style={{ fontWeight: 700 }}>Stardew Valley</div>
                            <div style={{ color: C.mutedLight, fontSize: 13 }}>Encaja en 1 h · te quedan 12 logros fáciles</div>
                        </div>
                    </div>
                </Card>
                <Card style={{ padding: 20, ...rise(f, 40) }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: F.display, fontWeight: 700, fontSize: 18 }}>
                        <Target size={18} color={C.primary} /> Metas de octubre
                    </div>
                    {[
                        { label: 'Completar 3 juegos', v: 2, of: 3 },
                        { label: '40 logros', v: 34, of: 40 },
                        { label: '1 juego al 100 %', v: 1, of: 1 },
                    ].map((m, i) => (
                        <div key={m.label} style={{ marginTop: 13 }}>
                            <div style={{ display: 'flex', fontSize: 14, marginBottom: 6 }}>
                                <span>{m.label}</span>
                                <span style={{ flex: 1 }} />
                                {m.v === m.of && goal > 0.95 ? (
                                    <Badge color={C.success}>Hecho</Badge>
                                ) : (
                                    <span style={{ fontFamily: F.mono, color: C.mutedLight, fontSize: 13 }}>
                                        {Math.round(m.v * ease(f, 70 + i * 5, 40))}/{m.of}
                                    </span>
                                )}
                            </div>
                            <Bar value={(m.v / m.of) * ease(f, 70 + i * 5, 40)} color={m.v === m.of ? C.success : C.grad} />
                        </div>
                    ))}
                </Card>
            </div>
        </div>
    )
}

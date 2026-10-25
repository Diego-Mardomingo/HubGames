import { Check, Clock, Gamepad2, Lightbulb, Search } from 'lucide-react'
import { Img } from 'remotion'
import { hero } from '../data'
import { C, F, ease, lerp, pop, rise } from '../theme'
import { Badge, Card, Kicker, Pill } from '../ui/kit'

const HINTS = ['2017', 'Metroidvania', 'Team Cherry', 'Insectos']
const ANSWER = 'Hollow Knight'

export const JudiMock = ({ f }: { f: number }) => {
    // Fases: cada captura nueva revela un poco más
    const phase = Math.min(5, Math.floor(Math.max(0, f - 10) / 16))
    const solved = f >= 112
    const blur = solved ? 0 : lerp(26, 6, phase / 5)
    const typed = ANSWER.slice(0, Math.max(0, Math.floor((f - 80) / 2)))
    const win = pop(f, 112, 20)
    return (
        <div style={{ padding: '26px 34px', height: '100%', display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 28 }}>
            <div style={{ display: 'flex', flexDirection: 'column', ...rise(f, 0) }}>
                <Kicker icon={<span style={{ width: 7, height: 7, borderRadius: 7, background: C.accent }} />} color={C.mutedLight}>
                    JUDI · juego del día
                </Kicker>
                <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 56, lineHeight: 1, letterSpacing: '-0.04em', marginTop: 12 }}>
                    ¿Qué juego
                    <br />
                    es{' '}
                    <span style={{ background: 'linear-gradient(120deg, #b69cff, #6f8bff)', WebkitBackgroundClip: 'text', color: 'transparent' }}>hoy</span>?
                </div>
                <div style={{ color: C.mutedLight, fontSize: 16, marginTop: 14 }}>6 capturas, 5 pistas y un único videojuego. Cuanto antes lo adivines, más puntos.</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
                    {HINTS.map((h, i) => {
                        const t = pop(f, 22 + i * 16, 16)
                        return (
                            <Pill key={h} style={{ opacity: Math.min(1, t), scale: String(lerp(0.6, 1, t)) }}>
                                <Lightbulb size={13} color={C.warning} /> {h}
                            </Pill>
                        )
                    })}
                </div>
                <div
                    style={{
                        marginTop: 20,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '13px 16px',
                        borderRadius: 14,
                        border: `1px solid ${solved ? 'rgba(52,211,153,0.6)' : 'rgba(154,134,255,0.45)'}`,
                        background: solved ? 'rgba(52,211,153,0.08)' : C.surface,
                        fontSize: 17,
                    }}
                >
                    {solved ? <Check size={18} color={C.success} /> : <Search size={18} color={C.muted} />}
                    <span style={{ color: typed ? C.fg : C.muted }}>
                        {typed || 'Escribe el nombre del juego…'}
                        {!solved && typed && (Math.floor(f / 8) % 2 ? '|' : '')}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 'auto', alignItems: 'center', color: C.mutedLight, fontSize: 14 }}>
                    <Clock size={15} /> Nuevo juego en <span style={{ fontFamily: F.mono, color: C.accent, fontWeight: 700 }}>07:20:59</span>
                </div>
            </div>
            <Card style={{ position: 'relative', overflow: 'hidden', padding: 0, ...rise(f, 4) }}>
                <Img src={hero(367520)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: `blur(${blur}px) saturate(${solved ? 1.1 : 0.7})`, scale: String(1.1 + phase * 0.02) }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,8,14,0.5), transparent 30%, transparent 60%, rgba(8,8,14,0.85))' }} />
                <div style={{ position: 'absolute', left: 18, top: 18, display: 'flex', gap: 8 }}>
                    <Badge color="#ffffff" style={{ fontFamily: F.mono, background: 'rgba(8,8,14,0.7)' }}>
                        <Gamepad2 size={12} /> JUDI #301
                    </Badge>
                    <Badge color={C.accent} style={{ background: 'rgba(8,8,14,0.7)' }}>
                        Captura {phase + 1}/6
                    </Badge>
                </div>
                <div style={{ position: 'absolute', right: 18, bottom: 18, display: 'flex', gap: 6 }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <span key={i} style={{ width: 10, height: 10, borderRadius: 10, background: i <= phase ? C.accent : 'rgba(255,255,255,0.25)' }} />
                    ))}
                </div>
                <div
                    style={{
                        position: 'absolute',
                        left: 22,
                        bottom: 18,
                        right: 120,
                        opacity: Math.min(1, win),
                        translate: `0 ${(1 - win) * 20}px`,
                    }}
                >
                    <div style={{ color: C.success, fontWeight: 700, fontSize: 15 }}>¡Acertado en el 4.º intento!</div>
                    <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 34 }}>
                        Hollow Knight <span style={{ color: C.accent }}>+4 pts</span>
                    </div>
                </div>
                {solved && <Confetti f={f - 112} />}
            </Card>
        </div>
    )
}

/** Confeti determinista (sin Math.random para que cada render sea idéntico). */
export const Confetti = ({ f, count = 46, originX = 50, originY = 70 }: { f: number; count?: number; originX?: number; originY?: number }) => {
    const colors = ['#b69cff', '#6f8bff', '#2ad4f0', '#34d399', '#fcd34d', '#fb7185']
    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            {Array.from({ length: count }).map((_, i) => {
                const a = ((i * 137.5) % 360) * (Math.PI / 180)
                const v = 9 + ((i * 53) % 9)
                const t = f
                const x = Math.cos(a) * v * t * 1.6
                const y = Math.sin(a) * v * t * 1.1 - 6 * t + 0.32 * t * t
                return (
                    <span
                        key={i}
                        style={{
                            position: 'absolute',
                            left: `${originX}%`,
                            top: `${originY}%`,
                            width: 8,
                            height: 13,
                            borderRadius: 2,
                            background: colors[i % colors.length],
                            translate: `${x}px ${y}px`,
                            rotate: `${i * 40 + t * (8 + (i % 5) * 4)}deg`,
                            opacity: Math.max(0, 1 - t / 50),
                        }}
                    />
                )
            })}
        </div>
    )
}

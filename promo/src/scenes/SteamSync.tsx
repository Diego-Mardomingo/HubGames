import { Clock, Gamepad2, Heart, Link2, Loader2, Trophy } from 'lucide-react'
import { AbsoluteFill, Img, useCurrentFrame } from 'remotion'
import { ALL_GAMES, cover } from '../data'
import { C, F, ease, lerp, nf, pop, rise } from '../theme'
import { Background } from '../ui/Background'
import { Card, Cursor, GradText } from '../ui/kit'

const CLICK = 46
const DONE = 84

export const SteamSync = () => {
    const f = useCurrentFrame()
    const press = Math.max(0, 1 - Math.abs(f - CLICK) / 6)
    const syncing = f >= CLICK && f < DONE
    const done = f >= DONE
    const n = ease(f, DONE, 46)
    const stats = [
        { Icon: Gamepad2, v: nf(Math.round(lerp(0, 412, n))), l: 'juegos', c: C.primary },
        { Icon: Clock, v: `${nf(Math.round(lerp(0, 4870, n)))} h`, l: 'jugadas', c: C.accent },
        { Icon: Trophy, v: nf(Math.round(lerp(0, 2311, n))), l: 'logros', c: C.gold },
        { Icon: Heart, v: nf(Math.round(lerp(0, 14, n))), l: 'en la wishlist', c: C.danger },
    ]
    return (
        <AbsoluteFill style={{ fontFamily: F.body, color: C.fg }}>
            <Background hue={-10} />
            {/* Carátulas que vuelan hacia la tarjeta mientras sincroniza */}
            {ALL_GAMES.map((g, i) => {
                const s = CLICK + 4 + i * 2
                const t = ease(f, s, 30)
                if (f < s) return null
                const a = (i / ALL_GAMES.length) * Math.PI * 2
                const r = lerp(1100, 0, t)
                return (
                    <Img
                        key={g.id}
                        src={cover(g)}
                        style={{
                            position: 'absolute',
                            left: 960 - 60,
                            top: 640 - 90,
                            width: 120,
                            height: 180,
                            borderRadius: 10,
                            objectFit: 'cover',
                            translate: `${Math.cos(a) * r}px ${Math.sin(a) * r * 0.6}px`,
                            rotate: `${(1 - t) * (i % 2 ? 40 : -40)}deg`,
                            scale: String(lerp(1, 0.2, t)),
                            opacity: t < 0.95 ? 1 : (1 - t) * 20,
                            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8)',
                        }}
                    />
                )
            })}
            <AbsoluteFill style={{ alignItems: 'center', paddingTop: 150 }}>
                <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 96, letterSpacing: '-0.045em', ...rise(f, 0, 24) }}>
                    Vincula Steam. <GradText>Listo.</GradText>
                </div>
                <div style={{ fontSize: 32, color: C.mutedLight, marginTop: 12, ...rise(f, 8, 24) }}>
                    Biblioteca, horas, logros y wishlist se sincronizan solos cada noche.
                </div>
                <Card glow={done} style={{ marginTop: 60, width: 1180, padding: 34, display: 'flex', flexDirection: 'column', alignItems: 'center', ...rise(f, 14, 24, 60) }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            padding: '20px 40px',
                            borderRadius: 999,
                            fontSize: 30,
                            fontWeight: 700,
                            color: '#fff',
                            background: done ? 'rgba(52,211,153,0.15)' : 'linear-gradient(120deg, #1b2838, #2a475e)',
                            border: `1px solid ${done ? 'rgba(52,211,153,0.6)' : 'rgba(102,192,244,0.5)'}`,
                            boxShadow: done ? '0 0 50px -10px rgba(52,211,153,0.6)' : '0 10px 40px -10px rgba(102,192,244,0.5)',
                            scale: String(1 - press * 0.06 + (done ? (1 - pop(f, DONE, 16)) * 0.1 : 0)),
                        }}
                    >
                        {syncing ? <Loader2 size={30} style={{ rotate: `${f * 12}deg` }} /> : <Link2 size={30} color={done ? C.success : '#66c0f4'} />}
                        {done ? 'Steam vinculado · Alex' : syncing ? 'Sincronizando tu biblioteca…' : 'Vincular con Steam'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, width: '100%', marginTop: 30, opacity: ease(f, DONE - 4, 14) }}>
                        {stats.map(({ Icon, v, l, c }, i) => (
                            <div key={l} style={{ padding: '20px 24px', borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, ...rise(f, DONE + i * 4, 18, 24) }}>
                                <Icon size={26} color={c} />
                                <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 52, letterSpacing: '-0.03em', marginTop: 6 }}>{v}</div>
                                <div style={{ color: C.mutedLight, fontSize: 22 }}>{l}</div>
                            </div>
                        ))}
                    </div>
                </Card>
            </AbsoluteFill>
            <Cursor
                x={lerp(1500, 1000, ease(f, 18, 26))}
                y={lerp(1000, 560, ease(f, 18, 26))}
                press={press}
                opacity={ease(f, 16, 8) * (1 - ease(f, 60, 10))}
            />
        </AbsoluteFill>
    )
}

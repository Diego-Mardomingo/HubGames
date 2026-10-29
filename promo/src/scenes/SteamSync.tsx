import { Award, Check, Clock, Gamepad2, Heart, Link2, Loader2 } from 'lucide-react'
import { AbsoluteFill, Img, useCurrentFrame } from 'remotion'
import { ALL_GAMES, USER, header } from '../data'
import { C, ease, lerp, nf, pop, rise, tint } from '../theme'
import { Background } from '../ui/Background'
import { Cursor, Panel, Themed } from '../ui/kit'

export const STEAM_T = { click: 40, done: 78 }
const { click: CLICK, done: DONE } = STEAM_T

/** Vincular Steam: el botón, la sincronización con las cápsulas que llegan y las cifras que cuentan. */
export const SteamSync = () => {
    const f = useCurrentFrame()
    const press = Math.max(0, 1 - Math.abs(f - CLICK) / 5)
    const syncing = f >= CLICK && f < DONE
    const done = f >= DONE
    const n = ease(f, DONE, 30)
    const stats = [
        { Icon: Gamepad2, v: nf(Math.round(lerp(0, 412, n))), l: 'juegos', c: C.st.jugando },
        { Icon: Clock, v: `${nf(Math.round(lerp(0, 4870, n)))} h`, l: 'jugadas', c: C.st.pendiente },
        { Icon: Award, v: nf(Math.round(lerp(0, 1873, n))), l: 'logros', c: C.st.sinfinal },
        { Icon: Heart, v: nf(Math.round(lerp(0, 13, n))), l: 'en la wishlist', c: C.st.favorito },
    ]
    return (
        <Themed mode="dark" style={{ position: 'absolute', inset: 0 }}>
            <AbsoluteFill>
                <Background />
                {ALL_GAMES.map((g, i) => {
                    const s = CLICK + 3 + i * 1.5
                    const t = ease(f, s, 24)
                    if (f < s || t >= 1) return null
                    const a = (i / ALL_GAMES.length) * Math.PI * 2
                    const r = lerp(1100, 0, t)
                    return (
                        <Img
                            key={g.id}
                            src={header(g)}
                            style={{
                                position: 'absolute',
                                left: 960 - 92,
                                top: 610 - 43,
                                width: 184,
                                height: 86,
                                borderRadius: 8,
                                objectFit: 'cover',
                                translate: `${Math.cos(a) * r}px ${Math.sin(a) * r * 0.6}px`,
                                rotate: `${(1 - t) * (i % 2 ? 20 : -20)}deg`,
                                scale: String(lerp(1, 0.25, t)),
                                opacity: t < 0.9 ? 1 : (1 - t) * 10,
                            }}
                        />
                    )
                })}
                <AbsoluteFill style={{ alignItems: 'center', paddingTop: 170 }}>
                    <div style={{ fontWeight: 800, fontSize: 92, letterSpacing: '-0.04em', ...rise(f, 0, 16, 30) }}>
                        Vinculas Steam <span style={{ color: C.primary }}>y listo.</span>
                    </div>
                    <div style={{ fontSize: 34, color: C.muted, marginTop: 14, ...rise(f, 6, 16, 24) }}>La app se entera sola de tu biblioteca, tus horas, tus logros y tu wishlist.</div>
                    <Panel style={{ marginTop: 64, width: 1140, padding: 34, display: 'flex', flexDirection: 'column', alignItems: 'center', ...rise(f, 10, 16, 40) }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 14,
                                height: 70,
                                padding: '0 36px',
                                borderRadius: 12,
                                fontSize: 30,
                                fontWeight: 700,
                                color: done ? C.success : C.primaryFg,
                                background: done ? tint(C.success) : C.primary,
                                scale: String(1 - press * 0.05 + (done ? (1 - pop(f, DONE, 12)) * 0.08 : 0)),
                            }}
                        >
                            {syncing ? <Loader2 size={30} style={{ rotate: `${f * 14}deg` }} /> : done ? <Check size={32} strokeWidth={3} /> : <Link2 size={30} />}
                            {done ? `Steam conectado · ${USER}` : syncing ? 'Sincronizando tu biblioteca…' : 'Conectar con Steam'}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, width: '100%', marginTop: 30, opacity: ease(f, DONE - 4, 10) }}>
                            {stats.map(({ Icon, v, l, c }, i) => (
                                <div key={l} style={{ padding: '18px 22px', borderRadius: 14, background: C.surface2, ...rise(f, DONE + i * 3, 12, 16) }}>
                                    <span style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 10, background: tint(c), color: c }}>
                                        <Icon size={22} />
                                    </span>
                                    <div style={{ fontWeight: 700, fontSize: 50, letterSpacing: '-0.02em', marginTop: 8 }}>{v}</div>
                                    <div style={{ color: C.muted, fontSize: 22 }}>{l}</div>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </AbsoluteFill>
                <Cursor x={lerp(1500, 1010, ease(f, 14, 22))} y={lerp(1000, 520, ease(f, 14, 22))} press={press} opacity={ease(f, 12, 6) * (1 - ease(f, 56, 8))} />
            </AbsoluteFill>
        </Themed>
    )
}

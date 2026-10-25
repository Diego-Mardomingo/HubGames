import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { C, F, ease, lerp, pop, rise } from '../theme'
import { Background } from '../ui/Background'
import { LogoMark } from '../ui/Logo'

export const Intro = () => {
    const f = useCurrentFrame()
    const draw = ease(f, 6, 40)
    const node = pop(f, 40, 18)
    const lift = ease(f, 58, 30)
    const word = 'hubgames'
    const flash = Math.max(0, 1 - Math.abs(f - 44) / 10)
    return (
        <AbsoluteFill style={{ fontFamily: F.body, color: C.fg }}>
            <Background />
            <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, rgba(127,232,255,${0.35 * flash}) 0%, transparent 40%)` }} />
            <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ translate: `0 ${lerp(0, -120, lift)}px`, scale: String(lerp(1, 0.62, lift)) }}>
                    <LogoMark size={300} draw={draw} node={node} />
                </div>
                <div
                    style={{
                        position: 'absolute',
                        top: '54%',
                        display: 'flex',
                        fontFamily: F.display,
                        fontWeight: 800,
                        fontSize: 150,
                        letterSpacing: '-0.05em',
                    }}
                >
                    {word.split('').map((ch, i) => {
                        const t = ease(f, 64 + i * 3, 22)
                        return (
                            <span
                                key={i}
                                style={{
                                    display: 'inline-block',
                                    opacity: t,
                                    translate: `0 ${(1 - t) * 60}px`,
                                    filter: t < 1 ? `blur(${(1 - t) * 12}px)` : undefined,
                                    ...(i >= 3 ? { background: C.grad, backgroundSize: '520px 100%', backgroundPosition: `${-(i - 3) * 104}px 0`, WebkitBackgroundClip: 'text', color: 'transparent' } : {}),
                                }}
                            >
                                {ch}
                            </span>
                        )
                    })}
                </div>
                <div style={{ position: 'absolute', top: '74%', fontSize: 40, color: C.mutedLight, letterSpacing: '-0.01em', ...rise(f, 92, 24) }}>
                    Tu centro de control gamer
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    )
}

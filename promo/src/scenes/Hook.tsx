import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { C, F, ease, lerp } from '../theme'
import { CoverWall } from '../ui/CoverWall'
import { GradText } from '../ui/kit'

const WORDS = ['Tu biblioteca.', 'Tus horas.', 'Tus logros.', 'Tu wishlist.']
const STEP = 18

export const Hook = () => {
    const f = useCurrentFrame()
    const finalStart = WORDS.length * STEP + 4
    const fin = ease(f, finalStart, 24)
    return (
        <AbsoluteFill style={{ fontFamily: F.display, color: C.fg, background: C.bg }}>
            <CoverWall dim={lerp(0.45, 0.7, fin)} speed={2.2} />
            <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
                {WORDS.map((w, i) => {
                    const s = i * STEP
                    const tin = ease(f, s, 10)
                    const tout = ease(f, s + STEP - 2, 8)
                    if (f < s - 1 || f > s + STEP + 8) return null
                    return (
                        <div
                            key={w}
                            style={{
                                position: 'absolute',
                                fontWeight: 800,
                                fontSize: 170,
                                letterSpacing: '-0.05em',
                                opacity: tin * (1 - tout),
                                scale: String(lerp(1.25, 1, tin) - tout * 0.1),
                                filter: `blur(${(1 - tin) * 16 + tout * 16}px)`,
                                textShadow: '0 10px 60px rgba(0,0,0,0.8)',
                            }}
                        >
                            {w}
                        </div>
                    )
                })}
                <div
                    style={{
                        position: 'absolute',
                        textAlign: 'center',
                        opacity: fin,
                        scale: String(lerp(0.85, 1, fin)),
                        filter: fin < 1 ? `blur(${(1 - fin) * 14}px)` : undefined,
                    }}
                >
                    <div style={{ fontWeight: 800, fontSize: 132, letterSpacing: '-0.05em', lineHeight: 1 }}>
                        Todo en <GradText>un solo sitio.</GradText>
                    </div>
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    )
}

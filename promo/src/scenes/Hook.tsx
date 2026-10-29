import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { C, ease, lerp, pop } from '../theme'
import { CoverWall } from '../ui/CoverWall'
import { Themed } from '../ui/kit'
import { LogoMark, Wordmark } from '../ui/Logo'

const LINES = ['Cientos de juegos en Steam.', 'Una cola que solo crece.', 'Logros a medias por todas partes.']
const STEP = 24

export const HOOK_FINAL = LINES.length * STEP + 4

/** Gancho: el problema en tres frases sobre el muro de cápsulas y, al final, la marca. */
export const Hook = () => {
    const f = useCurrentFrame()
    const fin = ease(f, HOOK_FINAL, 18)
    return (
        <Themed mode="dark" style={{ position: 'absolute', inset: 0 }}>
            <AbsoluteFill>
                <CoverWall dim={lerp(0.7, 0.86, fin)} speed={1.8} />
                <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
                    {LINES.map((w, i) => {
                        const s = i * STEP
                        const tin = ease(f, s, 9)
                        const tout = ease(f, s + STEP - 3, 7)
                        if (f < s - 1 || f > s + STEP + 6) return null
                        return (
                            <div
                                key={w}
                                style={{
                                    position: 'absolute',
                                    fontWeight: 800,
                                    fontSize: 116,
                                    letterSpacing: '-0.04em',
                                    color: C.fg,
                                    opacity: tin * (1 - tout),
                                    translate: `0 ${(1 - tin) * 30 - tout * 30}px`,
                                    textShadow: '0 8px 40px rgba(0,0,0,0.7)',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {w}
                            </div>
                        )
                    })}
                    <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30, opacity: fin }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 30, scale: String(lerp(0.9, 1, fin)) }}>
                            <LogoMark size={120} draw={ease(f, HOOK_FINAL, 22)} node={pop(f, HOOK_FINAL + 16, 12)} />
                            <Wordmark size={140} />
                        </div>
                        <div style={{ fontSize: 46, fontWeight: 600, color: C.muted, letterSpacing: '-0.01em', opacity: ease(f, HOOK_FINAL + 12, 14) }}>
                            Lo junta todo en un sitio.
                        </div>
                    </div>
                </AbsoluteFill>
            </AbsoluteFill>
        </Themed>
    )
}

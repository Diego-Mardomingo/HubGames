import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { C, ease, lerp, pop, rise } from '../theme'
import { CoverWall } from '../ui/CoverWall'
import { Themed } from '../ui/kit'
import { LogoMark, Wordmark } from '../ui/Logo'

/** Cierre: la marca y una frase. Sin llamada a registrarse ni URL: la app es privada. */
export const Outro = () => {
    const f = useCurrentFrame()
    const logo = pop(f, 4, 16)
    return (
        <Themed mode="dark" style={{ position: 'absolute', inset: 0 }}>
            <AbsoluteFill>
                <CoverWall dim={0.88} speed={0.8} />
                <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 34 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 34, opacity: Math.min(1, logo), scale: String(lerp(0.85, 1, logo)) }}>
                        <LogoMark size={130} draw={ease(f, 4, 22)} node={pop(f, 20, 12)} />
                        <Wordmark size={150} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 56, letterSpacing: '-0.025em', ...rise(f, 16, 16, 24) }}>
                        Tu Steam, <span style={{ color: C.primary }}>por fin ordenado.</span>
                    </div>
                    <div style={{ fontSize: 32, color: '#c9ced6', ...rise(f, 26, 16, 20) }}>Una app para mí y unos cuantos amigos.</div>
                </AbsoluteFill>
                <AbsoluteFill style={{ background: '#15171c', opacity: ease(f, 118, 16) }} />
            </AbsoluteFill>
        </Themed>
    )
}

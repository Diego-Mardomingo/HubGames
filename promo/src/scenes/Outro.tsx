import { ArrowRight, Bell, Smartphone, Sparkles } from 'lucide-react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { C, F, ease, lerp, pop, rise } from '../theme'
import { CoverWall } from '../ui/CoverWall'
import { LogoMark, Wordmark } from '../ui/Logo'
import { GradText, Pill } from '../ui/kit'

export const Outro = () => {
    const f = useCurrentFrame()
    const logo = pop(f, 4, 24)
    const glow = 0.5 + Math.sin(f / 8) * 0.25
    return (
        <AbsoluteFill style={{ fontFamily: F.body, color: C.fg, background: C.bg }}>
            <CoverWall dim={0.82} speed={0.9} />
            <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 26 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 28, opacity: Math.min(1, logo), scale: String(lerp(0.6, 1, logo)) }}>
                    <LogoMark size={150} tile />
                    <Wordmark size={130} />
                </div>
                <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 60, letterSpacing: '-0.03em', ...rise(f, 18, 24) }}>
                    Juega más. <GradText>Organiza menos.</GradText>
                </div>
                <div style={{ display: 'flex', gap: 14, ...rise(f, 30, 24) }}>
                    <Pill style={{ fontSize: 22, padding: '10px 20px' }}>
                        <Sparkles size={20} color={C.accent} /> Gratis
                    </Pill>
                    <Pill style={{ fontSize: 22, padding: '10px 20px' }}>
                        <Smartphone size={20} color={C.primary} /> Instalable en el móvil
                    </Pill>
                    <Pill style={{ fontSize: 22, padding: '10px 20px' }}>
                        <Bell size={20} color={C.gold} /> Avisos push
                    </Pill>
                </div>
                <div
                    style={{
                        marginTop: 20,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '22px 44px',
                        borderRadius: 999,
                        fontSize: 36,
                        fontWeight: 700,
                        color: '#fff',
                        background: 'linear-gradient(120deg, #8670ff, #5c7cff 55%, #22b8d8)',
                        boxShadow: `0 0 0 1px rgba(154,134,255,0.5), 0 20px 80px -10px rgba(111,139,255,${glow})`,
                        opacity: Math.min(1, pop(f, 44, 22)),
                        scale: String(lerp(0.7, 1, pop(f, 44, 22))),
                    }}
                >
                    hub-games.vercel.app <ArrowRight size={34} style={{ translate: `${Math.sin(f / 6) * 4}px 0` }} />
                </div>
            </AbsoluteFill>
            <AbsoluteFill style={{ background: C.bg, opacity: ease(f, 160, 20) }} />
        </AbsoluteFill>
    )
}

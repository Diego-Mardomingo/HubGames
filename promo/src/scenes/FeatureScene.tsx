import type { ReactNode } from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, F, ease, lerp, rise } from '../theme'
import { AppWindow, type NavKey } from '../ui/kit'
import { Background } from '../ui/Background'

type Props = {
    index: string
    kicker: string
    title: ReactNode
    body: string
    nav: NavKey
    side?: 'left' | 'right'
    hue?: number
    /** Contenido de la ventana; recibe el frame local (la maqueta empieza un poco después que el texto). */
    render: (f: number) => ReactNode
    /** Elementos extra fuera de la ventana (tarjetas flotantes, etc.). */
    extra?: (f: number) => ReactNode
}

const WIN_W = 1180
const WIN_H = 800

/** Escena de función: texto grande a un lado y la app en perspectiva al otro, con cámara lenta. */
export const FeatureScene = ({ index, kicker, title, body, nav, side = 'right', hue = 0, render, extra }: Props) => {
    const f = useCurrentFrame()
    const { durationInFrames } = useVideoConfig()
    const right = side === 'right'
    const enter = ease(f, 0, 34)
    const drift = f / durationInFrames
    const rotY = lerp(right ? -26 : 26, right ? -9 : 9, enter) + (right ? 1 : -1) * drift * 3
    return (
        <AbsoluteFill style={{ fontFamily: F.body, color: C.fg }}>
            <Background hue={hue} />
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    [right ? 'left' : 'right']: 120,
                    width: 560,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 22,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, ...rise(f, 4, 20) }}>
                    <span style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 20, color: C.accent }}>{index}</span>
                    <span style={{ width: lerp(0, 60, ease(f, 8, 24)), height: 2, background: C.grad }} />
                    <span style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 18, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.mutedLight }}>{kicker}</span>
                </div>
                <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 76, lineHeight: 1.02, letterSpacing: '-0.045em', ...rise(f, 8, 24, 50) }}>{title}</div>
                <div style={{ fontSize: 28, lineHeight: 1.45, color: C.mutedLight, ...rise(f, 16, 24, 40) }}>{body}</div>
            </div>
            <div
                style={{
                    position: 'absolute',
                    top: '50%',
                    [right ? 'left' : 'right']: 690,
                    perspective: 2200,
                }}
            >
                <div
                    style={{
                        translate: `${lerp(right ? 260 : -260, 0, enter)}px ${-WIN_H / 2 + Math.sin(f / 30) * 6}px`,
                        rotate: `y ${rotY}deg`,
                        scale: String(lerp(0.82, 0.94, enter) + drift * 0.03),
                        transformOrigin: right ? 'left center' : 'right center',
                        opacity: enter,
                    }}
                >
                    <AppWindow active={nav} width={WIN_W} height={WIN_H}>
                        {render(f - 10)}
                    </AppWindow>
                </div>
            </div>
            {extra?.(f)}
        </AbsoluteFill>
    )
}

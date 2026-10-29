import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, ease, lerp, rise, tint, type Mode } from '../theme'
import { Background } from '../ui/Background'
import { AppWindow, Themed, type NavKey } from '../ui/kit'

type Props = {
    mode: Mode
    kicker: { Icon: LucideIcon; color: string; label: string }
    title: ReactNode
    body: string
    nav: NavKey | ((f: number) => NavKey)
    side?: 'left' | 'right'
    /** Contenido de la ventana; recibe el frame local (la maqueta empieza un poco después que el texto). */
    render: (f: number) => ReactNode
    /** Elementos extra fuera de la ventana (móvil, avisos…). */
    extra?: (f: number) => ReactNode
    /** Frame en el que el texto se va (para dejar sitio a `extra`). */
    textOutAt?: number
}

export const WIN_W = 1180
export const WIN_H = 800

/** Escena de función: texto grande a un lado y la app al otro, en una perspectiva suave con cámara lenta. */
export const FeatureScene = ({ mode, kicker, title, body, nav, side = 'right', render, extra, textOutAt }: Props) => {
    const f = useCurrentFrame()
    const { durationInFrames } = useVideoConfig()
    const right = side === 'right'
    const enter = ease(f, 0, 26)
    const drift = f / durationInFrames
    const textOut = textOutAt === undefined ? 0 : ease(f, textOutAt, 12)
    const rotY = lerp(right ? -18 : 18, right ? -6 : 6, enter) + (right ? 1 : -1) * drift * 2
    return (
        <Themed mode={mode} style={{ position: 'absolute', inset: 0 }}>
            <AbsoluteFill>
                <Background />
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        [right ? 'left' : 'right']: 110,
                        width: 540,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: 24,
                        opacity: 1 - textOut,
                        translate: `${(right ? -1 : 1) * textOut * 40}px 0`,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...rise(f, 2, 14, 20) }}>
                        <span style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 11, background: tint(kicker.color), color: kicker.color }}>
                            <kicker.Icon size={24} strokeWidth={2.2} />
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 26, color: C.muted }}>{kicker.label}</span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 74, lineHeight: 1.04, letterSpacing: '-0.035em', ...rise(f, 5, 16, 30) }}>{title}</div>
                    <div style={{ fontSize: 29, lineHeight: 1.42, color: C.muted, ...rise(f, 10, 16, 24) }}>{body}</div>
                </div>
                <div style={{ position: 'absolute', top: '50%', [right ? 'left' : 'right']: 690, perspective: 2600 }}>
                    <div
                        style={{
                            translate: `${lerp(right ? 200 : -200, 0, enter)}px ${-WIN_H / 2 + Math.sin(f / 34) * 5}px`,
                            rotate: `y ${rotY}deg`,
                            scale: String(lerp(0.86, 0.95, enter) + drift * 0.025),
                            transformOrigin: right ? 'left center' : 'right center',
                            opacity: enter,
                        }}
                    >
                        <AppWindow active={typeof nav === 'function' ? nav(f) : nav} width={WIN_W} height={WIN_H}>
                            {render(f - 10)}
                        </AppWindow>
                    </div>
                </div>
                {extra?.(f)}
            </AbsoluteFill>
        </Themed>
    )
}

/** Fundido cruzado entre dos maquetas dentro de la misma ventana. */
export const CrossFade = ({ f, at, dur = 10, a, b }: { f: number; at: number; dur?: number; a: ReactNode; b: ReactNode }) => {
    const t = ease(f, at, dur)
    return (
        <>
            {t < 1 && <div style={{ position: 'absolute', inset: 0, opacity: 1 - t, translate: `${-t * 30}px 0` }}>{a}</div>}
            {t > 0 && <div style={{ position: 'absolute', inset: 0, opacity: t, translate: `${(1 - t) * 30}px 0` }}>{b}</div>}
        </>
    )
}

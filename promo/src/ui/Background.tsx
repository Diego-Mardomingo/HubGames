import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { C } from '../theme'

/** Fondo plano del tema con una retícula de puntos muy tenue que se desplaza despacio (sin degradados ni brillos). */
export const Background = ({ dots = true }: { dots?: boolean }) => {
    const frame = useCurrentFrame()
    return (
        <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
            {dots && (
                <AbsoluteFill
                    style={{
                        backgroundImage: `radial-gradient(color-mix(in srgb, ${C.fg} 9%, transparent) 1.2px, transparent 1.4px)`,
                        backgroundSize: '28px 28px',
                        backgroundPosition: `0 ${(frame * 0.25) % 28}px`,
                    }}
                />
            )}
        </AbsoluteFill>
    )
}

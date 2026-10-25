import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { C } from '../theme'

/** Fondo vivo: orbes de color que derivan, rejilla sutil con viñeta y grano. */
export const Background = ({ hue = 0, grid = true }: { hue?: number; grid?: boolean }) => {
    const frame = useCurrentFrame()
    const t = frame / 30
    const orb = (x: number, y: number, size: number, color: string, speed: number, phase: number) => (
        <div
            style={{
                position: 'absolute',
                left: `${x + Math.sin(t * speed + phase) * 6}%`,
                top: `${y + Math.cos(t * speed * 0.8 + phase) * 6}%`,
                width: size,
                height: size,
                translate: '-50% -50%',
                borderRadius: '50%',
                background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
                filter: 'blur(40px)',
            }}
        />
    )
    return (
        <AbsoluteFill style={{ background: C.bg, overflow: 'hidden', filter: hue ? `hue-rotate(${hue}deg)` : undefined }}>
            {orb(18, 22, 1100, 'rgba(154,134,255,0.30)', 0.35, 0)}
            {orb(86, 78, 1000, 'rgba(42,212,240,0.20)', 0.3, 2)}
            {orb(70, 10, 700, 'rgba(111,139,255,0.18)', 0.45, 4)}
            {grid && (
                <AbsoluteFill
                    style={{
                        backgroundImage:
                            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
                        backgroundSize: '64px 64px',
                        backgroundPosition: `0 ${(frame * 0.4) % 64}px`,
                        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 100%)',
                    }}
                />
            )}
            <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)' }} />
        </AbsoluteFill>
    )
}

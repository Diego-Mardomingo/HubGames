import { useId } from 'react'
import { C, F } from '../theme'

const STROKES = [
    { d: 'M13 14V50', len: 36 },
    { d: 'M13 32H21.5', len: 8.5 },
    { d: 'M50.5 20.5C48 16.5 44 14 38 14H31V22.5', len: 30 },
    { d: 'M31 41.5V50H38C45.5 50 50.5 45.5 50.5 39V32H40.5', len: 44 },
]

/** Monograma de HubGames (mismo trazo que src/components/brand/Logo.tsx). `draw` 0→1 lo dibuja. */
export const LogoMark = ({ size = 64, draw = 1, node = 1, tile = false }: { size?: number; draw?: number; node?: number; tile?: boolean }) => {
    const uid = useId().replace(/:/g, '')
    return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ overflow: 'visible' }}>
            <defs>
                <linearGradient id={`g${uid}`} gradientUnits="userSpaceOnUse" x1="10" y1="10" x2="54" y2="54">
                    <stop offset="0" stopColor="#b69cff" />
                    <stop offset="0.55" stopColor="#6f8bff" />
                    <stop offset="1" stopColor="#2ad4f0" />
                </linearGradient>
                <filter id={`f${uid}`} x="-150%" y="-150%" width="400%" height="400%">
                    <feGaussianBlur stdDeviation="2.4" result="b" />
                    <feMerge>
                        <feMergeNode in="b" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            {tile && <rect x="1" y="1" width="62" height="62" rx="18" fill="#100f1c" stroke={`url(#g${uid})`} strokeOpacity="0.45" strokeWidth="1.5" />}
            <g
                transform={tile ? 'translate(32 32) scale(0.74) translate(-32 -32)' : undefined}
                stroke={`url(#g${uid})`}
                strokeWidth={6.4}
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                {STROKES.map((s, i) => {
                    const t = Math.min(1, Math.max(0, draw * 1.6 - i * 0.2))
                    return <path key={s.d} d={s.d} strokeDasharray={s.len} strokeDashoffset={s.len * (1 - t)} opacity={t > 0 ? 1 : 0} />
                })}
                <circle cx="31" cy="32" r="5" stroke="#7fe8ff" strokeWidth="1.6" fill="none" opacity={node} />
                <circle
                    cx="31"
                    cy="32"
                    r={5.4 * node}
                    fill="#ffffff"
                    stroke="none"
                    filter={`url(#f${uid})`}
                />
            </g>
        </svg>
    )
}

export const Wordmark = ({ size = 28 }: { size?: number }) => (
    <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: size, letterSpacing: '-0.02em', color: C.fg }}>
        hub
        <span style={{ background: C.grad, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>games</span>
    </span>
)

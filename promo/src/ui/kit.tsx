import type { CSSProperties, ReactNode } from 'react'
import { Img } from 'remotion'
import { BarChart3, Gamepad2, Heart, House, Library, Search, Trophy, Award } from 'lucide-react'
import { C, F } from '../theme'
import { LogoMark, Wordmark } from './Logo'

export const Card = ({ children, style, glow }: { children?: ReactNode; style?: CSSProperties; glow?: boolean }) => (
    <div
        style={{
            background: 'linear-gradient(180deg, rgba(26,25,42,0.85), rgba(15,14,24,0.85))',
            border: `1px solid ${C.border}`,
            borderRadius: 16,
            boxShadow: glow
                ? '0 0 0 1px rgba(154,134,255,0.35), 0 10px 40px -8px rgba(111,139,255,0.45)'
                : 'inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 30px -12px rgba(0,0,0,0.6)',
            ...style,
        }}
    >
        {children}
    </div>
)

export const Kicker = ({ icon, children, color = C.mutedLight }: { icon?: ReactNode; children: ReactNode; color?: string }) => (
    <div
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: F.mono,
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color,
        }}
    >
        {icon}
        {children}
    </div>
)

export const Bar = ({ value, height = 6, color = C.grad, track = 'rgba(255,255,255,0.08)' }: { value: number; height?: number; color?: string; track?: string }) => (
    <div style={{ height, borderRadius: height, background: track, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: '100%', borderRadius: height, background: color }} />
    </div>
)

export const Pill = ({ children, active, style }: { children: ReactNode; active?: boolean; style?: CSSProperties }) => (
    <div
        style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 14px',
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 600,
            color: active ? '#fff' : C.mutedLight,
            background: active ? 'linear-gradient(120deg, #8670ff, #5c7cff)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${active ? 'rgba(154,134,255,0.6)' : C.border}`,
            boxShadow: active ? '0 6px 20px -6px rgba(134,112,255,0.7)' : undefined,
            whiteSpace: 'nowrap',
            ...style,
        }}
    >
        {children}
    </div>
)

export const Badge = ({ children, color, style }: { children: ReactNode; color: string; style?: CSSProperties }) => (
    <span
        style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 9px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            color,
            background: `${color}1f`,
            border: `1px solid ${color}55`,
            whiteSpace: 'nowrap',
            ...style,
        }}
    >
        {children}
    </span>
)

export const Cover = ({ src, style }: { src: string; style?: CSSProperties }) => (
    <Img src={src} style={{ display: 'block', objectFit: 'cover', ...style }} />
)

export const GradText = ({ children }: { children: ReactNode }) => (
    <span style={{ background: C.grad, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{children}</span>
)

const NAV = [
    { key: 'inicio', label: 'Inicio', Icon: House },
    { key: 'biblioteca', label: 'Biblioteca', Icon: Library },
    { key: 'logros', label: 'Logros', Icon: Award },
    { key: 'wishlist', label: 'Wishlist', Icon: Heart },
    { key: 'estadisticas', label: 'Estadísticas', Icon: BarChart3 },
    { key: 'judi', label: 'JUDI', Icon: Gamepad2 },
    { key: 'ranking', label: 'Ranking', Icon: Trophy },
] as const

export type NavKey = (typeof NAV)[number]['key']

/** Ventana de la app: barra de navegación igual que la web y el contenido debajo. */
export const AppWindow = ({ active, children, width, height, style }: { active: NavKey; children: ReactNode; width: number; height: number; style?: CSSProperties }) => (
    <div
        style={{
            width,
            height,
            borderRadius: 22,
            overflow: 'hidden',
            background: '#08080e',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 50px 120px -30px rgba(0,0,0,0.9), 0 0 0 1px rgba(154,134,255,0.12), 0 30px 80px -40px rgba(111,139,255,0.5)',
            fontFamily: F.body,
            color: C.fg,
            display: 'flex',
            flexDirection: 'column',
            ...style,
        }}
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '16px 26px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LogoMark size={26} />
                <Wordmark size={19} />
            </div>
            <div style={{ display: 'flex', gap: 2, padding: 4, borderRadius: 999, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)', marginLeft: 10 }}>
                {NAV.map(({ key, label, Icon }) => {
                    const on = key === active
                    return (
                        <div
                            key={key}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 12px',
                                borderRadius: 999,
                                fontSize: 13,
                                fontWeight: 600,
                                color: on ? '#fff' : C.mutedLight,
                                background: on ? 'linear-gradient(120deg, #8670ff, #3fb8f0)' : undefined,
                            }}
                        >
                            <Icon size={14} strokeWidth={2.2} />
                            {label}
                        </div>
                    )
                })}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, border: `1px solid ${C.border}`, color: C.muted, fontSize: 12 }}>
                <Search size={14} />
                <span style={{ fontFamily: F.mono, fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>Ctrl K</span>
            </div>
            <div
                style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #f0abfc, #818cf8)',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    fontSize: 13,
                    color: '#fff',
                }}
            >
                A
            </div>
        </div>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>{children}</div>
    </div>
)

/** Cursor de ratón con pulsación (`press` 0→1→0). */
export const Cursor = ({ x, y, press = 0, opacity = 1 }: { x: number; y: number; press?: number; opacity?: number }) => (
    <div style={{ position: 'absolute', left: x, top: y, opacity, pointerEvents: 'none', zIndex: 50 }}>
        <div
            style={{
                position: 'absolute',
                left: -22,
                top: -22,
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.7)',
                opacity: press,
                scale: String(0.5 + press),
            }}
        />
        <svg width="30" height="30" viewBox="0 0 24 24" style={{ scale: String(1 - press * 0.15), filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.6))' }}>
            <path d="M4 2l16 9.5-7 1.5-3.5 7z" fill="#fff" stroke="#111" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
    </div>
)

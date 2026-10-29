import type { CSSProperties, ReactNode } from 'react'
import { Img } from 'remotion'
import {
    Bookmark,
    ChartColumn,
    CircleX,
    Clock,
    EyeOff,
    Flag,
    Gamepad2,
    Heart,
    History,
    House,
    Inbox,
    Infinity as InfinityIcon,
    Library,
    Pause,
    Play,
    Repeat,
    Search,
    Shapes,
    Tag,
    ThumbsUp,
    Trophy,
    Award,
    type LucideIcon,
} from 'lucide-react'
import { C, F, mix, themeVars, tint, type Mode } from '../theme'
import { LogoMark, Wordmark } from './Logo'

/* ── Listas de la biblioteca (LIST_ICONS + tokens --st-*) ── */

export type ListKey = keyof typeof C.st

export const LISTS: Record<ListKey, { label: string; plural: string; Icon: LucideIcon; color: string }> = {
    bandeja: { label: 'Bandeja', plural: 'Bandeja', Icon: Inbox, color: C.st.bandeja },
    pendiente: { label: 'Pendiente', plural: 'Pendientes', Icon: Bookmark, color: C.st.pendiente },
    jugando: { label: 'Jugando', plural: 'Jugando', Icon: Play, color: C.st.jugando },
    pausado: { label: 'Pausado', plural: 'Pausados', Icon: Pause, color: C.st.pausado },
    rejugable: { label: 'Rejugable', plural: 'Rejugables', Icon: Repeat, color: C.st.rejugable },
    completado: { label: 'Completado', plural: 'Completados', Icon: Flag, color: C.st.completado },
    abandonado: { label: 'Abandonado', plural: 'Abandonados', Icon: CircleX, color: C.st.abandonado },
    yajugado: { label: 'Ya jugado', plural: 'Ya jugados', Icon: History, color: C.st.yajugado },
    descartado: { label: 'Descartado', plural: 'Descartados', Icon: EyeOff, color: C.st.descartado },
    otros: { label: 'Otros', plural: 'Otros', Icon: Shapes, color: C.st.otros },
    favorito: { label: 'Favorito', plural: 'Favoritos', Icon: Heart, color: C.st.favorito },
    sinfinal: { label: 'Sin final', plural: 'Sin final', Icon: InfinityIcon, color: C.st.sinfinal },
}

/** Contenedor con las variables de un tema (como `data-theme` en `<html>`). */
export const Themed = ({ mode, children, style }: { mode: Mode; children: ReactNode; style?: CSSProperties }) => (
    <div style={{ ...themeVars(mode), color: C.fg, fontFamily: F.body, fontVariantNumeric: 'tabular-nums', ...style }}>{children}</div>
)

/** Panel plano (`.glass` de la app: superficie, borde fino, radio 14). */
export const Panel = ({ children, style }: { children?: ReactNode; style?: CSSProperties }) => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, ...style }}>{children}</div>
)

/** Icono tintado en su cuadrado (cabeceras de sección, tiles, raíl). */
export const IconBox = ({ Icon, color, size = 26, icon = 14, dashed }: { Icon: LucideIcon; color: string; size?: number; icon?: number; dashed?: boolean }) => (
    <span
        style={{
            display: 'grid',
            placeItems: 'center',
            width: size,
            height: size,
            flex: 'none',
            borderRadius: size > 28 ? 8 : 6,
            background: tint(color),
            color,
            border: dashed ? `1px dashed ${color}` : undefined,
        }}
    >
        <Icon size={icon} strokeWidth={2.2} />
    </span>
)

/** Cabecera de sección del Inicio (`.dash-sec__head`): icono tintado, título y dato. */
export const SectionHead = ({ Icon, color, title, meta, right }: { Icon: LucideIcon; color: string; title: string; meta?: ReactNode; right?: ReactNode }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <IconBox Icon={Icon} color={color} size={28} icon={15} />
        <span style={{ fontWeight: 700, fontSize: 17 }}>{title}</span>
        {meta && <span style={{ color: C.muted, fontSize: 13 }}>{meta}</span>}
        <span style={{ flex: 1 }} />
        {right}
    </div>
)

/** Chip de estado (`StatusChip`): icono + nombre con el color de su lista. `from` + `t` para el cambio de color. */
export const StatusChip = ({ list, size = 12, from, t = 1, style }: { list: ListKey; size?: number; from?: ListKey; t?: number; style?: CSSProperties }) => {
    const to = LISTS[list]
    const show = from && t < 0.5 ? LISTS[from] : to
    const color = from ? mix(LISTS[from].color, to.color, t) : to.color
    const iconPop = from ? 1 + Math.sin(Math.min(1, t) * Math.PI) * 0.35 : 1
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: `${size * 0.2}px ${size * 0.7}px`,
                borderRadius: 999,
                fontSize: size,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                color,
                background: tint(color),
                border: list === 'bandeja' ? `1px dashed ${color}` : undefined,
                ...style,
            }}
        >
            <show.Icon size={size * 0.95} strokeWidth={2.4} style={{ scale: String(iconPop) }} />
            {show.label}
        </span>
    )
}

/** Marca junto al nombre (`MarkFlags`): corazón o ∞ en su cuadrado tintado. */
export const MarkFlag = ({ list, scale = 1 }: { list: 'favorito' | 'sinfinal'; scale?: number }) => {
    const { Icon, color } = LISTS[list]
    return (
        <span style={{ display: 'inline-grid', placeItems: 'center', width: 20, height: 20, borderRadius: 6, background: tint(color), color, scale: String(scale), flex: 'none' }}>
            <Icon size={12} strokeWidth={2.4} />
        </span>
    )
}

/** Puntuación con su nivel (`.hg-score`): cifra tintada con `--sc-*`. */
export const Score = ({ value, tier, icon, style }: { value: string; tier: keyof typeof C.sc; icon?: boolean; style?: CSSProperties }) => (
    <span
        style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            minWidth: 26,
            height: 20,
            padding: '0 6px',
            justifyContent: 'center',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            color: C.sc[tier],
            background: tint(C.sc[tier]),
            ...style,
        }}
    >
        {icon && <ThumbsUp size={11} strokeWidth={2.4} />}
        {value}
    </span>
)

/** Mínimo histórico (`.hg-deal`): amarillo sólido, lo más llamativo de un precio. */
export const Deal = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
    <span
        style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 6,
            background: C.deal,
            color: C.dealFg,
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            ...style,
        }}
    >
        {children}
    </span>
)

/** Chip tintado genérico. */
export const Tinted = ({ color, children, style }: { color: string; children: ReactNode; style?: CSSProperties }) => (
    <span
        style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 6,
            background: tint(color),
            color,
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            ...style,
        }}
    >
        {children}
    </span>
)

/** Barra de progreso (`.hg-bar`): pista en surface-2, relleno en cobalto o en el color que toque. */
export const Bar = ({ value, color = C.primary, height = 6, style }: { value: number; color?: string; height?: number; style?: CSSProperties }) => (
    <div style={{ height, borderRadius: 999, background: C.surface2, overflow: 'hidden', ...style }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 999, background: color, transformOrigin: 'left', scale: `${Math.max(0, Math.min(1, value))} 1` }} />
    </div>
)

/** Botón de la app (`.hg-button`). */
export const Button = ({
    children,
    variant = 'secondary',
    style,
    press = 0,
}: {
    children: ReactNode
    variant?: 'primary' | 'secondary' | 'done'
    style?: CSSProperties
    press?: number
}) => (
    <span
        style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            height: 34,
            padding: '0 14px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            scale: String(1 - press * 0.05),
            ...(variant === 'primary'
                ? { background: C.primary, color: C.primaryFg }
                : variant === 'done'
                  ? { background: C.st.completado, color: C.onDone }
                  : { background: C.surface, color: C.fg, border: `1px solid ${C.border}` }),
            ...style,
        }}
    >
        {children}
    </span>
)

/** Segmentado con fondo deslizante (`.hg-seg--slide`). `at` es la posición (con decimales mientras se desliza). */
export const Seg = ({ options, at, style, size = 13 }: { options: ReactNode[]; at: number; style?: CSSProperties; size?: number }) => {
    const i = Math.floor(at)
    const frac = at - i
    return (
        <div style={{ display: 'inline-flex', position: 'relative', gap: 2, padding: 3, borderRadius: 8, background: C.surface2, ...style }}>
            {options.map((o, k) => {
                const on = Math.round(at) === k
                return (
                    <div key={k} style={{ position: 'relative', padding: '5px 11px', borderRadius: 6, fontSize: size, fontWeight: 600, color: on ? C.primary : C.muted, whiteSpace: 'nowrap' }}>
                        {(k === i || (k === i + 1 && frac > 0)) && (
                            <span
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    borderRadius: 6,
                                    background: C.surface,
                                    boxShadow: C.shadowSm,
                                    opacity: k === i ? 1 - frac : frac,
                                }}
                            />
                        )}
                        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}>{o}</span>
                    </div>
                )
            })}
        </div>
    )
}

/** Tile de cifras (`.hg-tile`): icono tintado, etiqueta, valor y nota. */
export const Tile = ({ Icon, color, label, value, note, style, valueColor }: { Icon: LucideIcon; color: string; label: string; value: ReactNode; note?: ReactNode; style?: CSSProperties; valueColor?: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: 14, borderRadius: 12, background: C.surface2, minWidth: 0, ...style }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.muted, fontSize: 13, fontWeight: 500 }}>
            <IconBox Icon={Icon} color={color} size={24} icon={13} />
            {label}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em', color: valueColor, marginTop: 4, whiteSpace: 'nowrap' }}>{value}</div>
        {note && <div style={{ color: C.muted, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note}</div>}
    </div>
)

/** Cápsula de Steam (header.jpg) con radio pequeño. */
export const Cover = ({ src, style }: { src: string; style?: CSSProperties }) => <Img src={src} style={{ display: 'block', objectFit: 'cover', borderRadius: 6, background: C.surface2, ...style }} />

/** Fila con franja del color de su lista (`.lib-row`). */
export const Row = ({ color, children, style }: { color: string; children: ReactNode; style?: CSSProperties }) => (
    <div
        style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '9px 14px 9px 16px',
            borderRadius: 10,
            background: C.surface,
            border: `1px solid ${C.border}`,
            overflow: 'hidden',
            ...style,
        }}
    >
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: color }} />
        {children}
    </div>
)

/* ── Ventana de la app con la barra lateral ── */

const NAV = [
    { key: 'inicio', label: 'Inicio', Icon: House },
    { group: 'Tu colección' },
    { key: 'biblioteca', label: 'Biblioteca', Icon: Library },
    { key: 'logros', label: 'Logros', Icon: Award },
    { key: 'wishlist', label: 'Wishlist', Icon: Heart },
    { key: 'estadisticas', label: 'Estadísticas', Icon: ChartColumn },
    { group: 'Juego diario' },
    { key: 'judi', label: 'JUDI', Icon: Gamepad2 },
    { key: 'ranking', label: 'Ranking', Icon: Trophy },
] as const

export type NavKey = 'inicio' | 'biblioteca' | 'logros' | 'wishlist' | 'estadisticas' | 'judi' | 'ranking'

const NavIndicator = ({ k, bandeja }: { k: NavKey; bandeja: number }) => {
    if (k === 'biblioteca')
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 7px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: C.st.bandeja, background: tint(C.st.bandeja), border: `1px dashed ${C.st.bandeja}` }}>
                <Inbox size={11} strokeWidth={2.4} /> {bandeja}
            </span>
        )
    if (k === 'wishlist')
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 7px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: C.dealFg, background: C.deal }}>
                <Tag size={11} strokeWidth={2.4} /> 4
            </span>
        )
    if (k === 'judi')
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 7px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: C.warning, background: tint(C.warning) }}>
                <Clock size={11} strokeWidth={2.4} /> Hoy
            </span>
        )
    return null
}

/** Ventana de la app: barra lateral como la web (grupos, activo con superficie y barra cobalto) y el contenido. */
export const AppWindow = ({
    active,
    children,
    width,
    height,
    style,
    bandeja = 14,
    side = 208,
}: {
    active: NavKey
    children: ReactNode
    width: number
    height: number
    style?: CSSProperties
    bandeja?: number
    side?: number
}) => (
    <div
        style={{
            width,
            height,
            borderRadius: 16,
            overflow: 'hidden',
            background: C.bg,
            border: `1px solid ${C.border}`,
            boxShadow: C.shadowWin,
            fontFamily: F.body,
            color: C.fg,
            display: 'flex',
            ...style,
        }}
    >
        <div style={{ width: side, flex: 'none', borderRight: `1px solid ${C.border}`, padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', marginBottom: 16 }}>
                <LogoMark size={20} />
                <Wordmark size={16} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.muted, fontSize: 12.5, marginBottom: 10 }}>
                <Search size={13} /> Buscar juego
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: C.surface2 }}>Ctrl + K</span>
            </div>
            {NAV.map((n) => {
                if ('group' in n)
                    return (
                        <div key={n.group} style={{ fontSize: 11, fontWeight: 600, color: C.muted, padding: '12px 10px 4px' }}>
                            {n.group}
                        </div>
                    )
                const on = n.key === active
                return (
                    <div
                        key={n.key}
                        style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 10px',
                            borderRadius: 8,
                            fontSize: 14,
                            fontWeight: on ? 600 : 500,
                            color: C.fg,
                            background: on ? C.surface : undefined,
                            boxShadow: on ? C.shadowSm : undefined,
                        }}
                    >
                        {on && <span style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, borderRadius: 3, background: C.primary }} />}
                        <n.Icon size={16} strokeWidth={2} color={on ? C.primary : C.muted} />
                        {n.label}
                        <span style={{ flex: 1 }} />
                        <NavIndicator k={n.key} bandeja={bandeja} />
                    </div>
                )
            })}
        </div>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>{children}</div>
    </div>
)

/* ── Móvil: marco de teléfono con barra superior y pestañas abajo ── */

const TABS: { key: NavKey; label: string; Icon: LucideIcon }[] = [
    { key: 'inicio', label: 'Inicio', Icon: House },
    { key: 'biblioteca', label: 'Biblioteca', Icon: Library },
    { key: 'logros', label: 'Logros', Icon: Award },
    { key: 'wishlist', label: 'Wishlist', Icon: Heart },
    { key: 'judi', label: 'JUDI', Icon: Gamepad2 },
    { key: 'ranking', label: 'Ranking', Icon: Trophy },
]

export const PHONE_W = 390
export const PHONE_H = 844

export const Phone = ({ active, children, style, overlay, bare }: { active: NavKey; children: ReactNode; style?: CSSProperties; overlay?: ReactNode; bare?: boolean }) => (
    <div
        style={{
            width: PHONE_W + 24,
            height: PHONE_H + 24,
            padding: 12,
            borderRadius: 58,
            background: '#0b0c0f',
            boxShadow: '0 40px 90px -30px rgba(0,0,0,0.6), inset 0 0 0 2px #2a2d33',
            ...style,
        }}
    >
        <div style={{ position: 'relative', width: PHONE_W, height: PHONE_H, borderRadius: 46, overflow: 'hidden', background: C.bg, color: C.fg, fontFamily: F.body, display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 50, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', fontSize: 15, fontWeight: 600 }}>
                <span>21:30</span>
                <span style={{ position: 'absolute', left: '50%', top: 12, translate: '-50% 0', width: 110, height: 30, borderRadius: 20, background: '#0b0c0f' }} />
                <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span style={{ width: 18, height: 10, borderRadius: 3, border: `1.5px solid ${C.fg}`, position: 'relative' }}>
                        <span style={{ position: 'absolute', inset: 1.5, right: 5, borderRadius: 1, background: C.fg }} />
                    </span>
                </span>
            </div>
            {!bare && <div style={{ height: 48, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px', borderBottom: `1px solid ${C.border}` }}>
                <LogoMark size={18} />
                <Wordmark size={16} />
                <span style={{ flex: 1 }} />
                <span style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.border}`, color: C.muted }}>
                    <Search size={16} />
                </span>
            </div>}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>{children}</div>
            {!bare && <div style={{ height: 78, flex: 'none', display: 'flex', borderTop: `1px solid ${C.border}`, background: C.surface, paddingBottom: 16 }}>
                {TABS.map((t) => {
                    const on = t.key === active
                    return (
                        <div key={t.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, fontSize: 10.5, fontWeight: on ? 700 : 500, color: on ? C.primary : C.muted, position: 'relative' }}>
                            {on && <span style={{ position: 'absolute', top: 0, width: 28, height: 3, borderRadius: 3, background: C.primary }} />}
                            <t.Icon size={19} strokeWidth={2} />
                            {t.label}
                        </div>
                    )
                })}
            </div>}
            {overlay}
        </div>
    </div>
)

/** Cursor de ratón con pulsación (`press` 0→1→0). */
export const Cursor = ({ x, y, press = 0, opacity = 1 }: { x: number; y: number; press?: number; opacity?: number }) => (
    <div style={{ position: 'absolute', left: x, top: y, opacity, pointerEvents: 'none', zIndex: 50 }}>
        <div
            style={{
                position: 'absolute',
                left: -20,
                top: -20,
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'rgba(36,83,255,0.25)',
                opacity: press,
                scale: String(0.5 + press),
            }}
        />
        <svg width="26" height="26" viewBox="0 0 24 24" style={{ scale: String(1 - press * 0.15), filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))' }}>
            <path d="M4 2l16 9.5-7 1.5-3.5 7z" fill="#fff" stroke="#111" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
    </div>
)

/** Página de la app con título y subtítulo (`.page-head`). */
export const PageHead = ({ title, sub, right, style }: { title: string; sub?: ReactNode; right?: ReactNode; style?: CSSProperties }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, ...style }}>
        <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{title}</div>
            {sub && <div style={{ color: C.muted, fontSize: 14.5, marginTop: 4 }}>{sub}</div>}
        </div>
        <span style={{ flex: 1 }} />
        {right}
    </div>
)

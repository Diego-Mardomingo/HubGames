import { C, F } from '../theme'

const STEMS = 'M10 36V84M48 36V84'
const BAR = 'M16 60H42'
const G = 'M109.15 43.93A25 25 0 1 0 115 60H92'
const G_GAP = 'M109.15 43.93A25 25 0 0 1 115 60'
const RATIO = 120 / 64

/**
 * Monograma de HubGames (mismo dibujo que src/components/brand/Logo.tsx): la H con una barra de progreso al 70 % y la G
 * como anillo casi completo, con los colores del tema. `size` es el alto. `draw` 0→1 rellena la G; `node` 0→1 la barra.
 */
export const LogoMark = ({ size = 24, draw = 1, node = 1 }: { size?: number; draw?: number; node?: number }) => (
    <svg width={Math.round(size * RATIO)} height={size} viewBox="3 28 120 64" fill="none" strokeWidth={12} style={{ overflow: 'visible', flex: 'none' }}>
        <path d={STEMS} stroke={C.fg} strokeLinecap="round" opacity={Math.min(1, draw * 4)} />
        <path d={BAR} stroke={C.surface3} />
        <path d={BAR} pathLength={100} strokeDasharray="100 110" strokeDashoffset={105 - 75 * Math.min(1, node)} stroke={C.primary} />
        <path d={G_GAP} stroke={C.surface3} strokeLinecap="round" />
        <path d={G} stroke={C.surface3} strokeLinecap="round" strokeLinejoin="round" />
        <path d={G} pathLength={100} strokeDasharray="100 110" strokeDashoffset={105 * (1 - draw)} stroke={C.primary} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

export const Wordmark = ({ size = 28 }: { size?: number }) => (
    <span style={{ fontFamily: F.body, fontWeight: 700, fontSize: size, letterSpacing: '-0.02em', color: C.fg, whiteSpace: 'nowrap' }}>
        Hub<span style={{ color: C.primary }}>Games</span>
    </span>
)

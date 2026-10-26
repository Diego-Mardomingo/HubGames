import { C, F } from '../theme'

/** Colores de la marca (los del tema oscuro de la app). */
export const BRAND = { accent: '#7b9bff', track: '#323744', tile: '#15171c' }

const STEMS = 'M10 36V84M48 36V84'
const BAR = 'M16 60H42'
const G = 'M109.15 43.93A25 25 0 1 0 115 60H92'
const G_GAP = 'M109.15 43.93A25 25 0 0 1 115 60'

/**
 * Monograma de HubGames (mismo dibujo que src/components/brand/Logo.tsx): la H con una barra de progreso al 70 %
 * y la G como anillo casi completo. `draw` 0→1 rellena la G; `node` 0→1 rellena la barra de la H.
 */
export const LogoMark = ({ size = 64, draw = 1, node = 1, tile = false }: { size?: number; draw?: number; node?: number; tile?: boolean }) => (
    <svg width={size} height={size} viewBox={tile ? '-17 -20 160 160' : '3 0 120 120'} fill="none" strokeWidth={12} style={{ overflow: 'visible' }}>
        {tile && <rect x="-17" y="-20" width="160" height="160" rx="40" fill={BRAND.tile} stroke="rgba(255,255,255,0.1)" strokeWidth={2} />}
        <path d={STEMS} stroke={C.fg} strokeLinecap="round" opacity={Math.min(1, draw * 4)} />
        <path d={BAR} stroke={BRAND.track} />
        <path d={BAR} pathLength={100} strokeDasharray="100 110" strokeDashoffset={105 - 75 * Math.min(1, node)} stroke={BRAND.accent} />
        <path d={G_GAP} stroke={BRAND.track} strokeLinecap="round" />
        <path d={G} stroke={BRAND.track} strokeLinecap="round" strokeLinejoin="round" />
        <path d={G} pathLength={100} strokeDasharray="100 110" strokeDashoffset={105 * (1 - draw)} stroke={BRAND.accent} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

export const Wordmark = ({ size = 28 }: { size?: number }) => (
    <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: size, letterSpacing: '-0.02em', color: C.fg }}>
        Hub<span style={{ color: BRAND.accent }}>Games</span>
    </span>
)

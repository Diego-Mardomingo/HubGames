/**
 * Marca HubGames: la H y la G dibujadas como las barras y anillos de progreso de la interfaz.
 * El travesaño de la H es una barra al 70 % y la G un anillo casi completo; la abertura de la G queda como pista vacía.
 * Las animaciones (entrada, la barra que se completa al pasar el ratón y las de la 404 y el error)
 * viven en globals.css.
 */
const STEMS = 'M10 36V84M48 36V84'
const BAR = 'M16 60H42'
const G = 'M109.15 43.93A25 25 0 1 0 115 60H92'
const G_GAP = 'M109.15 43.93A25 25 0 0 1 115 60'

/** Recorte del viewBox alrededor del dibujo: ancho / alto. */
const VIEWBOX = '3 28 120 64'
const RATIO = 120 / 64

type LogoMarkProps = {
    /** Alto en px; el ancho sale de la proporción del monograma. */
    size?: number
    /** La G y la barra de la H se rellenan al montar. */
    animated?: boolean
    /**
     * Páginas de estado, una sola vez al montar: `lost` (404: la barra casi llega al 100 %, duda y vuelve a su 70 %) y
     * `broken` (error: la barra parpadea dos veces y se queda en rojo de error).
     */
    variant?: 'lost' | 'broken'
    className?: string
    title?: string
}

export function LogoMark({ size = 24, animated = false, variant, className, title }: LogoMarkProps) {
    const mode = variant ? `hg-mark--${variant}` : animated && 'hg-mark--intro'
    const classes = ['hg-mark', mode, className].filter(Boolean).join(' ')
    return (
        <svg
            className={classes}
            width={Math.round(size * RATIO)}
            height={size}
            viewBox={VIEWBOX}
            fill="none"
            strokeWidth={12}
            role={title ? 'img' : undefined}
            aria-label={title}
            aria-hidden={title ? undefined : true}
        >
            <path d={STEMS} stroke="currentColor" strokeLinecap="round" />
            <path d={BAR} stroke="var(--surface-3)" />
            <path className="hg-mark__bar" d={BAR} pathLength={100} stroke="var(--primary)" />
            <path d={G_GAP} stroke="var(--surface-3)" strokeLinecap="round" />
            <path d={G} stroke="var(--surface-3)" strokeLinecap="round" strokeLinejoin="round" />
            <path className="hg-mark__g" d={G} pathLength={100} stroke="var(--primary)" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

export function Wordmark({ className }: { className?: string }) {
    return (
        <span className={['hg-wordmark', className].filter(Boolean).join(' ')}>
            Hub<span className="hg-wordmark__accent">Games</span>
        </span>
    )
}

export function Logo({ size = 20, animated = true }: { size?: number; animated?: boolean }) {
    return (
        <span className="hg-logo">
            <LogoMark size={size} animated={animated} />
            <Wordmark />
        </span>
    )
}

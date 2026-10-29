import { AbsoluteFill, Img, useCurrentFrame } from 'remotion'
import { ALL_GAMES, header } from '../data'

/** Muro de cápsulas de Steam inclinado, con filas que se desplazan en sentidos alternos y un velo del fondo oscuro. */
export const CoverWall = ({ opacity = 1, speed = 1.2, dim = 0.6, veil = '21,23,28' }: { opacity?: number; speed?: number; dim?: number; veil?: string }) => {
    const frame = useCurrentFrame()
    const rows = 9
    const w = 368
    const h = 172
    const gap = 18
    return (
        <AbsoluteFill style={{ opacity, overflow: 'hidden', background: `rgb(${veil})` }}>
            <div style={{ position: 'absolute', left: '50%', top: '50%', display: 'flex', flexDirection: 'column', gap, translate: '-50% -50%', rotate: '-12deg', scale: '1.2' }}>
                {Array.from({ length: rows }).map((_, r) => {
                    const dir = r % 2 ? 1 : -1
                    const offset = ((frame * speed * dir + r * 131) % (w + gap)) - (w + gap)
                    return (
                        <div key={r} style={{ display: 'flex', gap, translate: `${offset}px 0` }}>
                            {Array.from({ length: 8 }).map((__, c) => {
                                const g = ALL_GAMES[(r * 5 + c * 3) % ALL_GAMES.length]
                                return <Img key={c} src={header(g)} style={{ width: w, height: h, objectFit: 'cover', borderRadius: 10, flex: 'none' }} />
                            })}
                        </div>
                    )
                })}
            </div>
            <AbsoluteFill style={{ background: `rgba(${veil},${dim})` }} />
        </AbsoluteFill>
    )
}

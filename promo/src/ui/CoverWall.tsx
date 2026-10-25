import { AbsoluteFill, Img, useCurrentFrame } from 'remotion'
import { ALL_GAMES, cover } from '../data'

/** Muro de carátulas inclinado con columnas que se desplazan en sentidos alternos. */
export const CoverWall = ({ opacity = 1, speed = 1.4, dim = 0.55 }: { opacity?: number; speed?: number; dim?: number }) => {
    const frame = useCurrentFrame()
    const cols = 9
    const w = 230
    const h = w * 1.5
    const gap = 22
    return (
        <AbsoluteFill style={{ opacity, overflow: 'hidden' }}>
            <div
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    display: 'flex',
                    gap,
                    translate: '-50% -50%',
                    rotate: '-14deg',
                    scale: '1.25',
                }}
            >
                {Array.from({ length: cols }).map((_, c) => {
                    const dir = c % 2 ? 1 : -1
                    const offset = ((frame * speed * dir + c * 97) % (h + gap)) - (h + gap)
                    return (
                        <div key={c} style={{ display: 'flex', flexDirection: 'column', gap, translate: `0 ${offset}px` }}>
                            {Array.from({ length: 6 }).map((__, r) => {
                                const g = ALL_GAMES[(c * 5 + r * 3) % ALL_GAMES.length]
                                return <Img key={r} src={cover(g)} style={{ width: w, height: h, objectFit: 'cover', borderRadius: 16, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8)' }} />
                            })}
                        </div>
                    )
                })}
            </div>
            <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, rgba(7,7,12,${dim}) 0%, rgba(7,7,12,${Math.min(1, dim + 0.35)}) 70%)` }} />
        </AbsoluteFill>
    )
}

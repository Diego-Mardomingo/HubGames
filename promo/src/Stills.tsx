import type { ReactNode } from 'react'
import { Play } from 'lucide-react'
import { AbsoluteFill } from 'remotion'
import { AchievementsMock } from './mocks/Achievements'
import { DashboardMock } from './mocks/Dashboard'
import { JudiMock } from './mocks/Judi'
import { LibraryMock } from './mocks/Library'
import { StatsMock } from './mocks/Stats'
import { WishlistMock } from './mocks/Wishlist'
import { C, F } from './theme'
import { Background } from './ui/Background'
import { CoverWall } from './ui/CoverWall'
import { BRAND, LogoMark } from './ui/Logo'
import { AppWindow, type NavKey } from './ui/kit'

/** Frame "final" de las maquetas: todo visible y quieto. */
const END = 400

const Window = ({ nav, children, scale, style }: { nav: NavKey; children: ReactNode; scale: number; style?: React.CSSProperties }) => (
    <div style={{ position: 'absolute', width: 1180 * scale, height: 800 * scale, ...style }}>
        <div style={{ scale: String(scale), transformOrigin: 'top left' }}>
            <AppWindow active={nav} width={1180} height={800}>
                {children}
            </AppWindow>
        </div>
    </div>
)

/** Portada del README (1600×820, se renderiza a 2x). */
export const Hero = () => (
    <AbsoluteFill style={{ fontFamily: F.body, color: C.fg }}>
        <Background />
        <div style={{ position: 'absolute', left: 90, top: 0, bottom: 0, width: 640, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <LogoMark size={110} tile />
            <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 112, letterSpacing: '-0.05em', lineHeight: 1, marginTop: 28 }}>
                Hub<span style={{ color: BRAND.accent }}>Games</span>
            </div>
            <div style={{ fontFamily: F.display, fontWeight: 600, fontSize: 40, letterSpacing: '-0.02em', marginTop: 18, color: '#d9d4ff' }}>Tu centro de control gamer.</div>
            <div style={{ fontSize: 24, lineHeight: 1.5, color: C.mutedLight, marginTop: 18 }}>
                Steam, tu biblioteca, la caza de logros, la wishlist y a qué jugar hoy, en un solo sitio.
            </div>
        </div>
        <div style={{ position: 'absolute', left: 760, top: 70, perspective: 2400 }}>
            <div style={{ rotate: 'y -16deg', transformOrigin: 'left center', position: 'relative', width: 1180, height: 740 }}>
                <Window nav="logros" scale={0.62} style={{ left: 330, top: 0, opacity: 0.55, filter: 'blur(1px)' }}>
                    <AchievementsMock f={END} />
                </Window>
                <Window nav="inicio" scale={0.72} style={{ left: 0, top: 180 }}>
                    <DashboardMock f={END} />
                </Window>
            </div>
        </div>
    </AbsoluteFill>
)

const SHOTS: { nav: NavKey; title: string; sub: string; node: ReactNode }[] = [
    { nav: 'inicio', title: 'Tu día de un vistazo', sub: 'En curso, siguiente y qué jugar hoy', node: <DashboardMock f={END} /> },
    { nav: 'biblioteca', title: 'Biblioteca que se ordena sola', sub: 'Estados, cola y avisos de terminado', node: <LibraryMock f={END} cursor={false} /> },
    { nav: 'logros', title: 'Caza de logros', sub: 'Rareza, hitos y juegos casi al 100 %', node: <AchievementsMock f={END} /> },
    { nav: 'wishlist', title: 'Compra en el mejor momento', sub: 'Mínimos históricos y avisos push', node: <WishlistMock f={END} notify={false} /> },
    { nav: 'estadisticas', title: 'Tu año en números', sub: 'Horas, géneros y resumen anual', node: <StatsMock f={END} /> },
    { nav: 'judi', title: 'JUDI, el juego del día', sub: 'Capturas, pistas y ranking', node: <JudiMock f={END} /> },
]

/** Rejilla de pantallas (1600×1240, se renderiza a 2x). */
export const Screens = () => {
    const s = 0.4
    return (
        <AbsoluteFill style={{ fontFamily: F.body, color: C.fg, background: '#0b0a14' }}>
            <Background grid={false} />
            <div style={{ position: 'absolute', inset: '60px 60px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', rowGap: 50, columnGap: 36 }}>
                {SHOTS.map((sh) => (
                    <div key={sh.nav} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ position: 'relative', width: 1180 * s, height: 800 * s }}>
                            <Window nav={sh.nav} scale={s}>
                                {sh.node}
                            </Window>
                        </div>
                        <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', marginTop: 22 }}>{sh.title}</div>
                        <div style={{ color: C.mutedLight, fontSize: 18, marginTop: 4 }}>{sh.sub}</div>
                    </div>
                ))}
            </div>
        </AbsoluteFill>
    )
}

/** Póster del vídeo para el README (enlaza al MP4). */
export const Poster = () => (
    <AbsoluteFill style={{ fontFamily: F.body, color: C.fg, background: C.bg }}>
        <CoverWall dim={0.62} speed={0} />
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 34 }}>
            <div
                style={{
                    width: 150,
                    height: 150,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'linear-gradient(120deg, #8670ff, #5c7cff 55%, #22b8d8)',
                    boxShadow: '0 0 0 10px rgba(154,134,255,0.18), 0 30px 90px -10px rgba(111,139,255,0.8)',
                }}
            >
                <Play size={64} fill="#fff" color="#fff" style={{ translate: '6px 0' }} />
            </div>
            <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 84, letterSpacing: '-0.045em', textShadow: '0 10px 50px rgba(0,0,0,0.8)' }}>
                Mira Hub<span style={{ color: BRAND.accent }}>Games</span> en 50 segundos
            </div>
        </AbsoluteFill>
    </AbsoluteFill>
)

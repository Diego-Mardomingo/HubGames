import type { CSSProperties, ReactNode } from 'react'
import { Play } from 'lucide-react'
import { AbsoluteFill } from 'remotion'
import { AchievementsMock } from './mocks/Achievements'
import { DashboardMock } from './mocks/Dashboard'
import { JudiMock } from './mocks/Judi'
import { LibraryMock } from './mocks/Library'
import { LibraryMobile, LockScreen } from './mocks/Mobile'
import { WishlistMock } from './mocks/Wishlist'
import { PROMO_DURATION } from './Promo'
import { C, type Mode } from './theme'
import { Background } from './ui/Background'
import { CoverWall } from './ui/CoverWall'
import { LogoMark, Wordmark } from './ui/Logo'
import { AppWindow, PHONE_H, PHONE_W, Phone, Themed, type NavKey } from './ui/kit'

/** Frame «final» de las maquetas: todo visible y quieto. */
const END = 400

const Window = ({ nav, mode, children, scale, style }: { nav: NavKey; mode: Mode; children: ReactNode; scale: number; style?: CSSProperties }) => (
    <Themed mode={mode} style={{ position: 'absolute', width: 1180 * scale, height: 800 * scale, ...style }}>
        <div style={{ scale: String(scale), transformOrigin: 'top left' }}>
            <AppWindow active={nav} width={1180} height={800}>
                {children}
            </AppWindow>
        </div>
    </Themed>
)

const MobileShot = ({ nav, mode, children, scale, style, bare }: { nav: NavKey; mode: Mode; children: ReactNode; scale: number; style?: CSSProperties; bare?: boolean }) => (
    <Themed mode={mode} style={{ position: 'absolute', width: (PHONE_W + 24) * scale, height: (PHONE_H + 24) * scale, ...style }}>
        <div style={{ scale: String(scale), transformOrigin: 'top left' }}>
            <Phone active={nav} bare={bare}>
                {children}
            </Phone>
        </div>
    </Themed>
)

/** Portada del README (1600×820, se renderiza a 2x): para ti y tus amigos, tu Steam, tus logros y qué jugar hoy. */
export const Hero = () => (
    <Themed mode="light" style={{ position: 'absolute', inset: 0 }}>
        <AbsoluteFill>
            <Background />
            <div style={{ position: 'absolute', left: 80, top: 0, bottom: 0, width: 600, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <LogoMark size={56} />
                    <Wordmark size={64} />
                </div>
                <div style={{ fontWeight: 800, fontSize: 54, lineHeight: 1.08, letterSpacing: '-0.035em', marginTop: 34 }}>
                    Tu biblioteca de Steam, tus logros y <span style={{ color: C.primary }}>qué jugar hoy.</span>
                </div>
                <div style={{ fontSize: 24, lineHeight: 1.5, color: C.muted, marginTop: 22 }}>Una app que me hice para mí y para unos cuantos amigos. Vinculas Steam y se entera sola de todo.</div>
            </div>
            <Window nav="inicio" mode="light" scale={0.66} style={{ left: 740, top: 92 }}>
                <DashboardMock f={END} />
            </Window>
            <MobileShot nav="biblioteca" mode="dark" scale={0.52} style={{ left: 1325, top: 330 }}>
                <LibraryMobile />
            </MobileShot>
        </AbsoluteFill>
    </Themed>
)

const Caption = ({ title, sub, style }: { title: string; sub: string; style?: CSSProperties }) => (
    <div style={{ position: 'absolute', ...style }}>
        <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-0.01em' }}>{title}</div>
        <div style={{ color: C.muted, fontSize: 16, marginTop: 3 }}>{sub}</div>
    </div>
)

/** Las cuatro partes centrales y JUDI, en escritorio y móvil, en claro y oscuro (1600×1000, se renderiza a 2x). */
export const Screens = () => {
    const big = 0.55
    const small = 0.37
    const bw = 1180 * big
    const sw = 1180 * small
    const x0 = 30
    const g1 = 18
    const r2 = 590
    const g2 = 30
    return (
        <Themed mode="light" style={{ position: 'absolute', inset: 0 }}>
            <AbsoluteFill>
                <Background dots={false} />
                <Window nav="inicio" mode="light" scale={big} style={{ left: x0, top: 36 }}>
                    <DashboardMock f={END} />
                </Window>
                <Caption title="Qué jugar hoy" sub="En curso, metas del mes y una propuesta para hoy" style={{ left: x0 + 6, top: 36 + 800 * big + 16 }} />
                <Window nav="biblioteca" mode="dark" scale={big} style={{ left: x0 + bw + g1, top: 36 }}>
                    <LibraryMock f={END} cursor={false} />
                </Window>
                <Caption title="Una biblioteca que se ordena sola" sub="Cada juego con su estado, su lista y su color" style={{ left: x0 + bw + g1 + 6, top: 36 + 800 * big + 16 }} />
                <MobileShot nav="biblioteca" mode="light" scale={0.5} style={{ left: x0 + 2 * bw + 2 * g1, top: 36 }}>
                    <LibraryMobile />
                </MobileShot>
                <Caption title="En el móvil" sub="Se instala como una app" style={{ left: x0 + 2 * bw + 2 * g1 + 6, top: 36 + 800 * big + 16 }} />

                <Window nav="logros" mode="dark" scale={small} style={{ left: x0, top: r2 }}>
                    <AchievementsMock f={80} />
                </Window>
                <Caption title="Logros con cabeza" sub="Rareza, casi al 100 % y tu año" style={{ left: x0 + 6, top: r2 + 800 * small + 16 }} />
                <Window nav="wishlist" mode="light" scale={small} style={{ left: x0 + sw + g2, top: r2 }}>
                    <WishlistMock f={END} />
                </Window>
                <Caption title="Comprar en el mejor momento" sub="Precio de hoy y mínimo histórico" style={{ left: x0 + sw + g2 + 6, top: r2 + 800 * small + 16 }} />
                <Window nav="judi" mode="dark" scale={small} style={{ left: x0 + 2 * (sw + g2), top: r2 }}>
                    <JudiMock f={95} />
                </Window>
                <Caption title="JUDI, el juego del día" sub="Capturas, pistas y ranking" style={{ left: x0 + 2 * (sw + g2) + 6, top: r2 + 800 * small + 16 }} />
                <MobileShot nav="wishlist" mode="dark" scale={0.34} bare style={{ left: x0 + 3 * (sw + g2), top: r2 }}>
                    <LockScreen />
                </MobileShot>
                <Caption title="Avisos" sub="Precios y JUDI" style={{ left: x0 + 3 * (sw + g2) + 4, top: r2 + 800 * small + 16 }} />
            </AbsoluteFill>
        </Themed>
    )
}

/** Póster del vídeo para el README (enlaza al MP4). */
export const Poster = () => (
    <Themed mode="dark" style={{ position: 'absolute', inset: 0 }}>
        <AbsoluteFill>
            <CoverWall dim={0.84} speed={0} />
            <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 36 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                    <LogoMark size={70} />
                    <Wordmark size={84} />
                </div>
                <div style={{ width: 140, height: 140, borderRadius: '50%', display: 'grid', placeItems: 'center', background: C.primary, boxShadow: '0 20px 50px -16px rgba(0,0,0,0.7)' }}>
                    <Play size={60} fill={C.primaryFg} color={C.primaryFg} style={{ translate: '5px 0' }} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 44, letterSpacing: '-0.02em', color: C.fg, textShadow: '0 6px 30px rgba(0,0,0,0.8)' }}>
                    Un recorrido de {Math.round(PROMO_DURATION / 30)} segundos
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    </Themed>
)

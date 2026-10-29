import { Audio } from '@remotion/media'
import { TransitionSeries, linearTiming } from '@remotion/transitions'
import { slide } from '@remotion/transitions/slide'
import { Award, Gamepad2, House, Library, Tag } from 'lucide-react'
import type { ReactNode } from 'react'
import { AbsoluteFill, Sequence, interpolate, staticFile, useVideoConfig } from 'remotion'
import { sfx } from './data'
import { ACH_T, AchievementsMock } from './mocks/Achievements'
import { DashboardMock } from './mocks/Dashboard'
import { FichaMock } from './mocks/Ficha'
import { JUDI_T, JudiMock } from './mocks/Judi'
import { LIB_T, LibraryMock } from './mocks/Library'
import { LockScreen } from './mocks/Mobile'
import { RankingMock } from './mocks/Ranking'
import { WISH_T, WishlistMock } from './mocks/Wishlist'
import { CrossFade, FeatureScene } from './scenes/FeatureScene'
import { HOOK_FINAL, Hook } from './scenes/Hook'
import { Outro } from './scenes/Outro'
import { STEAM_T, SteamSync } from './scenes/SteamSync'
import { C, ease, lerp } from './theme'
import { Phone, Themed } from './ui/kit'
import { zoomBlur } from './ui/zoomBlur'

const T = 15
const timing = linearTiming({ durationInFrames: T })

/** Duración de cada escena (30 fps). El orden es el del README. */
export const SCENES = {
    hook: 140,
    steam: 150,
    inicio: 165,
    biblioteca: 250,
    logros: 175,
    wishlist: 205,
    judi: 245,
    outro: 135,
}

export const PROMO_DURATION = Object.values(SCENES).reduce((a, b) => a + b, 0) - (Object.keys(SCENES).length - 1) * T

/** La maqueta empieza 10 frames después que la escena (ver FeatureScene). */
const M = 10
/** Biblioteca: la lista y, después, la ficha. */
const FICHA_AT = 150
/** JUDI: la partida y, después, el ranking. */
const RANKING_AT = 168
/** Wishlist: el móvil con los avisos. */
const PHONE_AT = 100

/** Efecto de sonido en un frame concreto de la escena. */
const Sfx = ({ at, name, volume = 0.5 }: { at: number; name: string; volume?: number }) => (
    <Sequence from={Math.round(at)} layout="none">
        <Audio src={sfx(name)} volume={volume} />
    </Sequence>
)

const withSfx = (scene: ReactNode, fx?: ReactNode) => (
    <>
        {scene}
        <Sfx at={0} name="maximize_006" volume={0.3} />
        {fx}
    </>
)

export const Promo = () => {
    const { fps } = useVideoConfig()
    return (
        <AbsoluteFill style={{ background: '#15171c' }}>
            <TransitionSeries>
                <TransitionSeries.Sequence name="Gancho" durationInFrames={SCENES.hook}>
                    <Hook />
                    {[0, 24, 48].map((at) => (
                        <Sfx key={at} at={at} name="tick_002" volume={0.55} />
                    ))}
                    <Sfx at={HOOK_FINAL} name="powerUp7" volume={0.35} />
                </TransitionSeries.Sequence>
                <TransitionSeries.Transition presentation={zoomBlur()} timing={timing} />

                <TransitionSeries.Sequence name="Steam" durationInFrames={SCENES.steam}>
                    {withSfx(
                        <SteamSync />,
                        <>
                            <Sfx at={STEAM_T.click} name="click_002" volume={0.8} />
                            <Sfx at={STEAM_T.done} name="confirmation_002" volume={0.5} />
                        </>
                    )}
                </TransitionSeries.Sequence>
                <TransitionSeries.Transition presentation={zoomBlur()} timing={timing} />

                <TransitionSeries.Sequence name="Inicio" durationInFrames={SCENES.inicio}>
                    {withSfx(
                        <FeatureScene
                            mode="light"
                            kicker={{ Icon: House, color: C.primary, label: 'Inicio' }}
                            nav="inicio"
                            title={
                                <>
                                    Qué jugar <span style={{ color: C.primary }}>hoy.</span>
                                </>
                            }
                            body="Lo que tienes en curso, tus metas del mes y una propuesta según el tiempo que tienes y lo que te apetece."
                            render={(f) => <DashboardMock f={f} />}
                        />,
                        <>
                            <Sfx at={M + 46} name="select_003" volume={0.4} />
                            <Sfx at={M + 70} name="select_003" volume={0.4} />
                            <Sfx at={M + 78} name="pluck_001" volume={0.35} />
                        </>
                    )}
                </TransitionSeries.Sequence>
                <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={timing} />

                <TransitionSeries.Sequence name="Biblioteca" durationInFrames={SCENES.biblioteca}>
                    {withSfx(
                        <FeatureScene
                            mode="dark"
                            side="left"
                            kicker={{ Icon: Library, color: C.st.jugando, label: 'Biblioteca' }}
                            nav="biblioteca"
                            title={
                                <>
                                    Una biblioteca <span style={{ color: C.primary }}>que se ordena sola.</span>
                                </>
                            }
                            body="Cada juego con su estado. Lo cambias y se va a su lista al momento; y en su ficha ves cuánto te falta."
                            render={(f) => <CrossFade f={f} at={FICHA_AT - M} a={<LibraryMock f={f} />} b={<FichaMock f={f - (FICHA_AT - M) - 4} />} />}
                        />,
                        <>
                            <Sfx at={M + LIB_T.menuClick} name="click_002" volume={0.7} />
                            <Sfx at={M + LIB_T.pick} name="click_002" volume={0.7} />
                            <Sfx at={M + LIB_T.out} name="minimize_006" volume={0.3} />
                            <Sfx at={M + LIB_T.land} name="toggle_002" volume={0.45} />
                            <Sfx at={FICHA_AT} name="maximize_006" volume={0.25} />
                            <Sfx at={FICHA_AT + 4 + 46} name="pluck_001" volume={0.45} />
                        </>
                    )}
                </TransitionSeries.Sequence>
                <TransitionSeries.Transition presentation={slide({ direction: 'from-left' })} timing={timing} />

                <TransitionSeries.Sequence name="Logros" durationInFrames={SCENES.logros}>
                    {withSfx(
                        <FeatureScene
                            mode="light"
                            kicker={{ Icon: Award, color: C.rar.epica, label: 'Logros' }}
                            nav="logros"
                            title={
                                <>
                                    Logros <span style={{ color: C.primary }}>con cabeza.</span>
                                </>
                            }
                            body="Un logro del 1 % vale mucho más que uno del 50 %. Los fáciles que te faltan, los casi al 100 % y tu año con sus rachas."
                            render={(f) => <AchievementsMock f={f} />}
                        />,
                        <Sfx at={M + ACH_T.unlock} name="twoTone1" volume={0.45} />
                    )}
                </TransitionSeries.Sequence>
                <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={timing} />

                <TransitionSeries.Sequence name="Wishlist" durationInFrames={SCENES.wishlist}>
                    {withSfx(
                        <FeatureScene
                            mode="dark"
                            side="left"
                            kicker={{ Icon: Tag, color: C.deal, label: 'Wishlist' }}
                            nav="wishlist"
                            title={
                                <>
                                    Comprar en el <span style={{ color: C.primary }}>mejor momento.</span>
                                </>
                            }
                            body="El precio de hoy frente al mínimo histórico, en Steam y en cualquier tienda. Y un aviso cuando baja."
                            render={(f) => <WishlistMock f={f} />}
                            textOutAt={PHONE_AT - 6}
                            extra={(f) => {
                                const t = ease(f, PHONE_AT, 18)
                                return (
                                    <Themed mode="dark" style={{ position: 'absolute', left: 1333, top: 106, opacity: t, translate: `${(1 - t) * 260}px 0`, rotate: `${lerp(6, 0, t)}deg` }}>
                                        <div>
                                            <Phone active="wishlist" bare>
                                                <LockScreen t1={ease(f, PHONE_AT + 22, 10)} t2={ease(f, PHONE_AT + 50, 10)} />
                                            </Phone>
                                        </div>
                                    </Themed>
                                )
                            }}
                        />,
                        <>
                            <Sfx at={M + WISH_T.hit} name="glass_002" volume={0.55} />
                            <Sfx at={PHONE_AT} name="maximize_006" volume={0.25} />
                            <Sfx at={PHONE_AT + 22} name="pluck_001" volume={0.5} />
                            <Sfx at={PHONE_AT + 50} name="pluck_001" volume={0.45} />
                        </>
                    )}
                </TransitionSeries.Sequence>
                <TransitionSeries.Transition presentation={zoomBlur()} timing={timing} />

                <TransitionSeries.Sequence name="JUDI" durationInFrames={SCENES.judi}>
                    {withSfx(
                        <FeatureScene
                            mode="light"
                            kicker={{ Icon: Gamepad2, color: C.primary, label: 'JUDI' }}
                            nav={(f) => (f >= RANKING_AT + 4 ? 'ranking' : 'judi')}
                            title={
                                <>
                                    JUDI, <span style={{ color: C.primary }}>el juego del día.</span>
                                </>
                            }
                            body="Un videojuego por adivinar con 6 capturas y 5 pistas. Cuanto antes aciertas, más puntos, y un ranking para picarse."
                            render={(f) => <CrossFade f={f} at={RANKING_AT - M} a={<JudiMock f={f} />} b={<RankingMock f={f - (RANKING_AT - M)} />} />}
                        />,
                        <>
                            <Sfx at={M + JUDI_T.fail1} name="toggle_002" volume={0.4} />
                            <Sfx at={M + JUDI_T.skip} name="tick_002" volume={0.5} />
                            <Sfx at={M + JUDI_T.fail2} name="toggle_002" volume={0.4} />
                            <Sfx at={M + JUDI_T.hit} name="powerUp7" volume={0.4} />
                            <Sfx at={RANKING_AT} name="maximize_006" volume={0.25} />
                            <Sfx at={RANKING_AT + 22} name="phaserUp3" volume={0.22} />
                        </>
                    )}
                </TransitionSeries.Sequence>
                <TransitionSeries.Transition presentation={zoomBlur()} timing={timing} />

                <TransitionSeries.Sequence name="Cierre" durationInFrames={SCENES.outro}>
                    {withSfx(<Outro />, <Sfx at={20} name="confirmation_002" volume={0.4} />)}
                </TransitionSeries.Sequence>
            </TransitionSeries>
            <Audio
                src={staticFile('music.wav')}
                volume={(f) =>
                    interpolate(f, [0, fps * 0.5, PROMO_DURATION - fps * 2, PROMO_DURATION], [0, 0.55, 0.55, 0], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                    })
                }
            />
        </AbsoluteFill>
    )
}

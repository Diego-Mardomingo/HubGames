import { Audio } from '@remotion/media'
import { TransitionSeries, linearTiming } from '@remotion/transitions'
import { slide } from '@remotion/transitions/slide'
import type { ReactNode } from 'react'
import { AbsoluteFill, Sequence, interpolate, staticFile, useVideoConfig } from 'remotion'
import { sfx } from './data'
import { AchievementsMock } from './mocks/Achievements'
import { DashboardMock } from './mocks/Dashboard'
import { JudiMock } from './mocks/Judi'
import { LibraryMock } from './mocks/Library'
import { StatsMock, WrappedCard } from './mocks/Stats'
import { WishlistMock } from './mocks/Wishlist'
import { FeatureScene } from './scenes/FeatureScene'
import { Hook } from './scenes/Hook'
import { Intro } from './scenes/Intro'
import { Outro } from './scenes/Outro'
import { SteamSync } from './scenes/SteamSync'
import { ease, lerp, pop } from './theme'
import { GradText } from './ui/kit'
import { zoomBlur } from './ui/zoomBlur'

const T = 16
const timing = linearTiming({ durationInFrames: T })

export const SCENES = {
    intro: 130,
    hook: 120,
    steam: 170,
    dashboard: 165,
    library: 160,
    achievements: 170,
    wishlist: 165,
    stats: 170,
    judi: 175,
    outro: 180,
}

export const PROMO_DURATION = Object.values(SCENES).reduce((a, b) => a + b, 0) - (Object.keys(SCENES).length - 1) * T

/** Efecto de sonido en un frame concreto de la escena. */
const Sfx = ({ at, name, volume = 0.5 }: { at: number; name: string; volume?: number }) => (
    <Sequence from={at} layout="none">
        <Audio src={sfx(name)} volume={volume} />
    </Sequence>
)

const Whoosh = () => <Sfx at={0} name="maximize_006" volume={0.35} />

const withSfx = (scene: ReactNode, fx?: ReactNode) => (
    <>
        {scene}
        <Whoosh />
        {fx}
    </>
)

export const Promo = () => {
    const { fps } = useVideoConfig()
    return (
        <AbsoluteFill style={{ background: '#07070c' }}>
            <TransitionSeries>
                <TransitionSeries.Sequence name="Intro" durationInFrames={SCENES.intro}>
                    <Intro />
                    <Sfx at={40} name="powerUp7" volume={0.35} />
                </TransitionSeries.Sequence>
                <TransitionSeries.Transition presentation={zoomBlur()} timing={timing} />

                <TransitionSeries.Sequence name="Hook" durationInFrames={SCENES.hook}>
                    {withSfx(
                        <Hook />,
                        <>
                            {[0, 18, 36, 54].map((at) => (
                                <Sfx key={at} at={at} name="tick_002" volume={0.6} />
                            ))}
                            <Sfx at={76} name="phaserUp3" volume={0.25} />
                        </>
                    )}
                </TransitionSeries.Sequence>
                <TransitionSeries.Transition presentation={zoomBlur()} timing={timing} />

                <TransitionSeries.Sequence name="Steam" durationInFrames={SCENES.steam}>
                    {withSfx(
                        <SteamSync />,
                        <>
                            <Sfx at={46} name="click_002" volume={0.8} />
                            <Sfx at={84} name="confirmation_002" volume={0.5} />
                        </>
                    )}
                </TransitionSeries.Sequence>
                <TransitionSeries.Transition presentation={zoomBlur()} timing={timing} />

                <TransitionSeries.Sequence name="Dashboard" durationInFrames={SCENES.dashboard}>
                    {withSfx(
                        <FeatureScene
                            index="01"
                            kicker="Inicio"
                            nav="inicio"
                            title={
                                <>
                                    Tu día gamer, <GradText>de un vistazo.</GradText>
                                </>
                            }
                            body="Qué estás jugando, qué viene después y qué te conviene jugar hoy según el tiempo que tienes."
                            render={(f) => <DashboardMock f={f} />}
                        />,
                        <Sfx at={74} name="select_003" volume={0.4} />
                    )}
                </TransitionSeries.Sequence>
                <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={timing} />

                <TransitionSeries.Sequence name="Biblioteca" durationInFrames={SCENES.library}>
                    {withSfx(
                        <FeatureScene
                            index="02"
                            kicker="Biblioteca"
                            nav="biblioteca"
                            side="left"
                            hue={20}
                            title={
                                <>
                                    Una biblioteca <GradText>que se ordena sola.</GradText>
                                </>
                            }
                            body="Estados automáticos, cola de pendientes y un aviso cuando parece que has terminado un juego."
                            render={(f) => <LibraryMock f={f} />}
                        />,
                        <>
                            <Sfx at={108} name="click_002" volume={0.8} />
                            <Sfx at={110} name="confirmation_002" volume={0.4} />
                        </>
                    )}
                </TransitionSeries.Sequence>
                <TransitionSeries.Transition presentation={slide({ direction: 'from-left' })} timing={timing} />

                <TransitionSeries.Sequence name="Logros" durationInFrames={SCENES.achievements}>
                    {withSfx(
                        <FeatureScene
                            index="03"
                            kicker="Logros"
                            nav="logros"
                            hue={-25}
                            title={
                                <>
                                    Caza logros <GradText>como un pro.</GradText>
                                </>
                            }
                            body="Puntuación por rareza, hitos, logros fáciles que te faltan y juegos a punto del 100 %."
                            render={(f) => <AchievementsMock f={f} />}
                        />,
                        <Sfx at={106} name="twoTone1" volume={0.45} />
                    )}
                </TransitionSeries.Sequence>
                <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={timing} />

                <TransitionSeries.Sequence name="Wishlist" durationInFrames={SCENES.wishlist}>
                    {withSfx(
                        <FeatureScene
                            index="04"
                            kicker="Wishlist"
                            nav="wishlist"
                            side="left"
                            hue={35}
                            title={
                                <>
                                    Compra en el <GradText>mejor momento.</GradText>
                                </>
                            }
                            body="Precio actual, mínimo histórico en Steam y en cualquier tienda, y un aviso push cuando toca."
                            render={(f) => <WishlistMock f={f} />}
                        />,
                        <>
                            <Sfx at={78} name="pluck_001" volume={0.5} />
                            <Sfx at={94} name="glass_002" volume={0.6} />
                        </>
                    )}
                </TransitionSeries.Sequence>
                <TransitionSeries.Transition presentation={slide({ direction: 'from-left' })} timing={timing} />

                <TransitionSeries.Sequence name="Estadísticas" durationInFrames={SCENES.stats}>
                    {withSfx(
                        <FeatureScene
                            index="05"
                            kicker="Estadísticas"
                            nav="estadisticas"
                            hue={-10}
                            title={
                                <>
                                    Tu año, <GradText>en números.</GradText>
                                </>
                            }
                            body="Horas, completados, géneros y logros por mes. Y un resumen anual listo para compartir."
                            render={(f) => <StatsMock f={f} />}
                            extra={(f) => (
                                <div
                                    style={{
                                        position: 'absolute',
                                        right: 90,
                                        top: 150,
                                        rotate: `${lerp(14, 5, ease(f, 92, 30))}deg`,
                                        opacity: Math.min(1, pop(f, 92, 24)),
                                        translate: `${(1 - ease(f, 92, 30)) * 200}px ${(1 - ease(f, 92, 30)) * 80}px`,
                                    }}
                                >
                                    <WrappedCard f={f - 96} width={360} />
                                </div>
                            )}
                        />,
                        <Sfx at={92} name="maximize_006" volume={0.35} />
                    )}
                </TransitionSeries.Sequence>
                <TransitionSeries.Transition presentation={zoomBlur()} timing={timing} />

                <TransitionSeries.Sequence name="JUDI" durationInFrames={SCENES.judi}>
                    {withSfx(
                        <FeatureScene
                            index="06"
                            kicker="JUDI"
                            nav="judi"
                            side="left"
                            hue={50}
                            title={
                                <>
                                    Y cada día, <GradText>un reto.</GradText>
                                </>
                            }
                            body="Adivina el videojuego del día con capturas y pistas, y escala en el ranking."
                            render={(f) => <JudiMock f={f} />}
                        />,
                        <>
                            {[26, 42, 58, 74].map((at) => (
                                <Sfx key={at} at={at + 10} name="toggle_002" volume={0.4} />
                            ))}
                            <Sfx at={122} name="powerUp7" volume={0.4} />
                        </>
                    )}
                </TransitionSeries.Sequence>
                <TransitionSeries.Transition presentation={zoomBlur()} timing={timing} />

                <TransitionSeries.Sequence name="Outro" durationInFrames={SCENES.outro}>
                    {withSfx(<Outro />, <Sfx at={44} name="confirmation_002" volume={0.4} />)}
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

import type { TransitionPresentation, TransitionPresentationComponentProps } from '@remotion/transitions'
import { AbsoluteFill, Easing, interpolate } from 'remotion'

type Props = Record<string, never>

const ZoomBlur = ({ children, presentationDirection, presentationProgress }: TransitionPresentationComponentProps<Props>) => {
    const p = Easing.bezier(0.65, 0, 0.35, 1)(presentationProgress)
    const entering = presentationDirection === 'entering'
    const scale = entering ? interpolate(p, [0, 1], [0.86, 1]) : interpolate(p, [0, 1], [1, 1.18])
    const blur = entering ? (1 - p) * 18 : p * 18
    const opacity = entering ? interpolate(p, [0, 0.6], [0, 1], { extrapolateRight: 'clamp' }) : interpolate(p, [0.4, 1], [1, 0], { extrapolateLeft: 'clamp' })
    return <AbsoluteFill style={{ scale: String(scale), filter: blur > 0.2 ? `blur(${blur}px)` : undefined, opacity }}>{children}</AbsoluteFill>
}

/** Transición "cámara": la escena que sale se acerca y se desenfoca; la que entra llega desde atrás. */
export const zoomBlur = (): TransitionPresentation<Props> => ({ component: ZoomBlur, props: {} })

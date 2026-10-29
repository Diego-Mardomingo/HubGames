import { Composition, Folder, Still } from 'remotion'
import { PROMO_DURATION, Promo } from './Promo'
import { Hero, Poster, Screens } from './Stills'

export const RemotionRoot = () => (
    <>
        <Composition id="Promo" component={Promo} durationInFrames={PROMO_DURATION} fps={30} width={1920} height={1080} />
        <Folder name="README">
            <Still id="Hero" component={Hero} width={1600} height={820} />
            <Still id="Poster" component={Poster} width={1600} height={900} />
            <Still id="Screens" component={Screens} width={1600} height={1000} />
        </Folder>
    </>
)

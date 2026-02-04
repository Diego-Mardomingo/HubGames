import GameSearch from '@/components/GameSearch'
import Loader from '@/components/Loader'
import { Suspense } from 'react'

export default function Home() {
    return (
        <div className="cuerpo">
            <Suspense fallback={<Loader />}>
                <GameSearch />
            </Suspense>
        </div>
    )
}

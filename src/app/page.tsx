import GameSearch from '@/components/GameSearch'
import { Suspense } from 'react'

export default function Home() {
    return (
        <div className="cuerpo">
            <Suspense fallback={<div style={{ textAlign: 'center', color: '#fff', padding: '2em' }}>Cargando buscador...</div>}>
                <GameSearch />
            </Suspense>
        </div>
    )
}

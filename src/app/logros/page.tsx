'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { safeGetSession } from '@/lib/supabase/client'
import { loadLibrary } from '@/lib/tracker'
import { loadEasyMissing, loadUnlockedAchievements } from '@/lib/achievements-db'
import SkeletonSwap from '@/components/SkeletonSwap'
import LogrosSkeleton from './LogrosSkeleton'
import LogrosView, { type LogrosData } from './LogrosView'

/** "Fácil" = lo tiene más de la mitad de los jugadores. */
const EASY_PERCENT = 50

export default function LogrosPage() {
    const router = useRouter()
    const [data, setData] = useState<LogrosData | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        safeGetSession().then(({ data: { session } }) => {
            if (!session) {
                router.push('/login')
                return
            }
            // Pedimos de sobra: luego se quitan los juegos marcados como "Descartado".
            Promise.all([loadLibrary(), loadUnlockedAchievements(), loadEasyMissing(EASY_PERCENT, 300)])
                .then(([games, unlocked, easy]) => setData({ games, unlocked, easy }))
                .catch((e: Error) => {
                    setError(e.message)
                    setData({ games: [], unlocked: [], easy: [] })
                })
        })
    }, [router])

    if (!data) return <SkeletonSwap skeleton={<LogrosSkeleton />} resetScroll />
    return (
        <SkeletonSwap skeleton={<LogrosSkeleton />}>
            <LogrosView data={data} error={error} />
        </SkeletonSwap>
    )
}

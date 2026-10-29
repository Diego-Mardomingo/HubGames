'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { safeGetSession, supabase } from '@/lib/supabase/client'
import { loadSteamLinked } from '@/lib/steam-link'
import { loadLibrary } from '@/lib/tracker'
import { loadUnlockedAchievements } from '@/lib/achievements-db'
import SkeletonSwap from '@/components/SkeletonSwap'
import HistorialSkeleton from './HistorialSkeleton'
import HistorialView, { type HistorialData } from './HistorialView'

/** Línea temporal y mapa de desbloqueos (#28), con las rachas de días seguidos con algún logro. */
export default function HistorialPage() {
    const router = useRouter()
    const [data, setData] = useState<HistorialData | null>(null)
    const [error, setError] = useState('')

    const load = useCallback(() => {
        safeGetSession().then(({ data: { session } }) => {
            if (!session) {
                router.push('/login')
                return
            }
            Promise.all([loadUnlockedAchievements(), loadLibrary(), loadSteamLinked(supabase)])
                .then(([unlocked, games, steamLinked]) => {
                    setError('')
                    setData({ unlocked, games, steamLinked })
                })
                .catch((e: Error) => {
                    setError(e.message)
                    setData({ unlocked: [], games: [], steamLinked: null })
                })
        })
    }, [router])

    useEffect(load, [load])

    if (!data) return <SkeletonSwap skeleton={<HistorialSkeleton />} resetScroll />
    return (
        <SkeletonSwap skeleton={<HistorialSkeleton />}>
            <HistorialView data={data} error={error} onReload={load} />
        </SkeletonSwap>
    )
}

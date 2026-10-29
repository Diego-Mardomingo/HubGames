'use client'

import './admin.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, safeGetUser } from '@/lib/supabase/client'
import { Skeleton, SkeletonZone } from '@/components/ui/skeleton'
import AdminView from './AdminView'

export default function AdminPage() {
    const router = useRouter()
    const [userId, setUserId] = useState<string | null>(null)
    const [state, setState] = useState<'checking' | 'admin' | 'no'>('checking')

    // El proxy ya protege /admin en el servidor; esto es solo una segunda comprobación en cliente.
    useEffect(() => {
        Promise.all([safeGetUser(), supabase.rpc('is_admin')])
            .then(([{ data: { user } }, { data: admin }]) => {
                if (user && admin === true) {
                    setUserId(user.id)
                    setState('admin')
                } else {
                    setState('no')
                    router.replace('/')
                }
            })
            .catch(() => {
                setState('no')
                router.replace('/')
            })
    }, [router])

    if (state === 'checking') {
        return (
            <SkeletonZone label="Cargando la administración">
                <div className="ad">
                    <header className="ad-head">
                        <div>
                            <h1 className="page-title">Administración</h1>
                            <p className="page-subtitle">Estado de JUDI y de las sincronizaciones con Steam. Solo lo ven los admins.</p>
                        </div>
                    </header>
                    <div className="hg-tiles ad-tiles" aria-hidden>
                        {[0, 1, 2, 3].map((i) => (
                            <Skeleton key={i} h={112} style={{ borderRadius: 12 }} />
                        ))}
                    </div>
                </div>
            </SkeletonZone>
        )
    }
    if (state === 'no') return null
    return <AdminView userId={userId} />
}

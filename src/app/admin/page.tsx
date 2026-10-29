'use client'

import './admin.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, safeGetUser } from '@/lib/supabase/client'
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
            <div className="admin-loading">
                <div className="loader" />
            </div>
        )
    }
    if (state === 'no') return null
    return <AdminView userId={userId} />
}

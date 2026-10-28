'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import { buildRanking, type JudiProgressRecord } from '@/lib/judi-ranking'
import { judiStats, memberSince, type JudiStats } from '@/lib/profile'
import Loader from '@/components/Loader'
import ProfileCard from './ProfileCard'
import AccountSetting from './AccountSetting'
import SteamSetting, { type SteamLink } from './SteamSetting'
import PrefsSetting from './PrefsSetting'
import ExportSetting from './ExportSetting'
import ExitZone from './ExitZone'
import AdminCard from './AdminCard'
import JudiPanel from './JudiPanel'
import type { Notify } from './Section'
import '@/components/dashboard/dashboard.css'
import './perfil.css'

type RankingEntry = ReturnType<typeof buildRanking>[number]

const EMPTY_JUDI: JudiStats = { aciertos: 0, fallos: 0, total: 0, precision: 0, puntos: 0 }

/**
 * Perfil: tu tarjeta de usuario (identidad + cuenta de Steam), los ajustes con color (Cuenta, Steam, Preferencias, Tus datos,
 * Salir) y, en la columna lateral, Administración (solo admins) y JUDI con el top 5. Sin cifras de juegos: eso vive en
 * Biblioteca, Logros y Estadísticas. Lógica pura en src/lib/profile.ts.
 */
export default function PerfilPage() {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [displayName, setDisplayName] = useState('')
    const [isAdmin, setIsAdmin] = useState(false)
    const [link, setLink] = useState<SteamLink | null>(null)
    const [steamLoaded, setSteamLoaded] = useState(false)
    const [judi, setJudi] = useState<JudiStats>(EMPTY_JUDI)
    const [ranking, setRanking] = useState<RankingEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => {
        const timer = error ? setTimeout(() => setError(''), 5000) : null
        return () => {
            if (timer) clearTimeout(timer)
        }
    }, [error])
    useEffect(() => {
        const timer = success ? setTimeout(() => setSuccess(''), 3500) : null
        return () => {
            if (timer) clearTimeout(timer)
        }
    }, [success])

    const notify: Notify = useCallback((kind, text) => {
        if (kind === 'ok') {
            setError('')
            setSuccess(text)
        } else {
            setSuccess('')
            setError(text)
        }
    }, [])

    useEffect(() => {
        let alive = true
        ;(async () => {
            const {
                data: { session },
            } = await safeGetSession()
            if (!session) {
                router.push('/login')
                return
            }
            const u = session.user
            const [admin, steam, fases, rankingRows] = await Promise.all([
                supabase.rpc('is_admin'),
                supabase.from('hubgames_user_steam').select('*').maybeSingle(),
                supabase.from('hubgames_judi_fases_usuario').select('completado, fase1, fase2, fase3, fase4, fase5, fase6').eq('id_usuario', u.id),
                supabase.rpc('hubgames_judi_ranking_rows'),
            ])
            if (!alive) return
            setUser(u)
            setDisplayName(u.user_metadata?.username || 'Usuario')
            setIsAdmin(admin.data === true)
            setLink(steam.data)
            setSteamLoaded(true)
            setJudi(fases.error ? EMPTY_JUDI : judiStats((fases.data ?? []) as JudiProgressRecord[]))
            setRanking(rankingRows.error || !rankingRows.data ? [] : buildRanking(rankingRows.data as JudiProgressRecord[]))
            setLoading(false)
        })()
        return () => {
            alive = false
        }
    }, [router])

    if (loading || !user) return <Loader label="Cargando perfil" />

    const linked = link !== null
    const steam = (i: number) => (
        <Suspense fallback={null}>
            <SteamSetting link={link} onLink={setLink} index={i} />
        </Suspense>
    )
    const account = (i: number) => (
        <AccountSetting userId={user.id} username={user.user_metadata?.username || ''} onSaved={setDisplayName} notify={notify} index={i} />
    )

    return (
        <div className="pf">
            <div className="pf-toasts" aria-live="polite">
                <AnimatePresence>
                    {error && (
                        <motion.div
                            key={`e-${error}`}
                            className="alert alert--error pf-toast"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.18 }}
                        >
                            <AlertTriangle size={15} aria-hidden /> {error}
                        </motion.div>
                    )}
                    {success && (
                        <motion.div
                            key={`s-${success}`}
                            className="alert alert--ok pf-toast"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.18 }}
                        >
                            <CheckCircle size={15} aria-hidden /> {success}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <ProfileCard
                name={displayName}
                email={user.email ?? ''}
                isAdmin={isAdmin}
                since={memberSince(user.created_at)}
                link={link}
                steamLoaded={steamLoaded}
            />

            <div className="pf-grid">
                <div className="pf-main">
                    {/* Sin Steam, lo primero es conectarlo */}
                    {linked ? account(1) : steam(1)}
                    {linked ? steam(2) : account(2)}
                    <PrefsSetting notify={notify} index={3} />
                    <ExportSetting index={4} />
                </div>
                <aside className="pf-aside">
                    {isAdmin && <AdminCard index={2} />}
                    <JudiPanel stats={judi} ranking={ranking} userId={user.id} index={isAdmin ? 3 : 2} />
                </aside>
                <div className="pf-out">
                    <ExitZone linked={linked} onUnlinked={() => setLink(null)} notify={notify} index={5} />
                </div>
            </div>
        </div>
    )
}

'use client'

import { Suspense, useEffect, useState } from 'react'
import SteamSetting from './SteamSetting'
import ExportSetting from './ExportSetting'
import { useRouter } from 'next/navigation'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import { getNotificationPreference, subscribeToDailyNotifications, disableDailyNotifications } from '@/lib/notifications'
import { buildRanking, getPointsForRecord, type JudiProgressRecord } from '@/lib/judi-ranking'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LogOut, AlertTriangle, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import Loader from '@/components/Loader'
import ThemeToggle from '@/components/ThemeToggle'
import './perfil.css'

export default function PerfilPage() {
    const router = useRouter()
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [username, setUsername] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [updating, setUpdating] = useState(false)
    const [judiStats, setJudiStats] = useState<any>(null)
    const [leaderboardPreview, setLeaderboardPreview] = useState<any[]>([])
    const [userRank, setUserRank] = useState<number | null>(null)
    const [totalRankedUsers, setTotalRankedUsers] = useState(0)
    const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null)
    const [notificationsLoading, setNotificationsLoading] = useState(false)

    useEffect(() => { checkUser() }, [])
    useEffect(() => {
        const timer = error ? setTimeout(() => setError(''), 5000) : null
        return () => { if (timer) clearTimeout(timer) }
    }, [error])
    useEffect(() => {
        const timer = success ? setTimeout(() => setSuccess(''), 3500) : null
        return () => { if (timer) clearTimeout(timer) }
    }, [success])
    useEffect(() => {
        const loadPreference = async () => {
            try {
                const enabled = await getNotificationPreference()
                setNotificationsEnabled(enabled)
            } catch {
                setNotificationsEnabled(false)
            }
        }
        loadPreference()
    }, [])

    const checkUser = async () => {
        const { data: { session } } = await safeGetSession()
        if (!session) { router.push('/login'); return }
        setUser(session.user)
        setUsername(session.user.user_metadata?.username || '')
        await Promise.all([
            fetchJudiStats(session.user.id),
            fetchLeaderboard(session.user.id),
        ])
        setLoading(false)
    }

    const fetchJudiStats = async (userId: string) => {
        const { data, error: statsError } = await supabase
            .from('hubgames_judi_fases_usuario')
            .select('completado, fase1, fase2, fase3, fase4, fase5, fase6')
            .eq('id_usuario', userId)
        if (statsError) {
            setJudiStats({ aciertos: 0, fallos: 0, total: 0, porcentaje_acierto: 0, puntos: 0 })
            return
        }
        const aciertos = data?.filter((f) => f.completado).length || 0
        const fallos = data?.filter((f) => f.fase6 && !f.completado).length || 0
        const total = aciertos + fallos
        const porcentaje_acierto = total > 0 ? Math.round((aciertos / total) * 100) : 0
        const puntos = (data || []).reduce(
            (sum, f) => sum + (getPointsForRecord(f as JudiProgressRecord) || 0), 0,
        )
        setJudiStats({ aciertos, fallos, total, porcentaje_acierto, puntos })
    }

    const fetchLeaderboard = async (currentUserId: string) => {
        const { data: records, error: leaderboardError } = await supabase.rpc('hubgames_judi_ranking_rows')
        if (leaderboardError || !records) return
        const sorted = buildRanking(records as JudiProgressRecord[])
        setTotalRankedUsers(sorted.length)
        setLeaderboardPreview(sorted.slice(0, 5))
        const pos = sorted.findIndex((e) => e.userId === currentUserId)
        setUserRank(pos !== -1 ? pos + 1 : null)
    }

    const handleUpdateUsername = async (event: React.FormEvent) => {
        event.preventDefault()
        setUpdating(true); setError(''); setSuccess('')
        try {
            const { error: authError } = await supabase.auth.updateUser({ data: { username } })
            if (authError) throw authError
            const { error: dbError } = await supabase.from('hubgames_usuarios').update({ username }).eq('id', user.id)
            if (dbError) throw dbError
            setSuccess('Username actualizado')
            await checkUser()
        } catch (err: any) {
            setError(err.message || 'Error al actualizar el username')
        } finally { setUpdating(false) }
    }

    const handleUpdatePassword = async (event: React.FormEvent) => {
        event.preventDefault()
        setUpdating(true); setError(''); setSuccess('')
        if (newPassword !== confirmPassword) { setError('Las contraseñas no coinciden'); setUpdating(false); return }
        if (newPassword.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); setUpdating(false); return }
        try {
            const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword })
            if (passwordError) throw passwordError
            setSuccess('Contraseña actualizada')
            setNewPassword(''); setConfirmPassword('')
        } catch (err: any) {
            setError(err.message || 'Error al actualizar contraseña')
        } finally { setUpdating(false) }
    }

    const handleToggleNotifications = async () => {
        if (notificationsEnabled === null) return
        setNotificationsLoading(true); setError(''); setSuccess('')
        try {
            if (notificationsEnabled) {
                const ok = await disableDailyNotifications()
                if (!ok) throw new Error('No se han podido desactivar las notificaciones')
                setNotificationsEnabled(false); setSuccess('Notificaciones desactivadas')
            } else {
                const result = await subscribeToDailyNotifications()
                if (!result.success) throw new Error(result.error || 'No se han podido activar las notificaciones')
                setNotificationsEnabled(true); setSuccess('Notificaciones activadas')
            }
        } catch (err: any) {
            setError(err.message || 'Error al actualizar notificaciones')
        } finally { setNotificationsLoading(false) }
    }

    const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

    if (loading) return <Loader label="Cargando perfil" />

    const initial = (user?.user_metadata?.username || user?.email || 'U')[0].toUpperCase()
    const displayName = user?.user_metadata?.username || 'Usuario'
    const puntos = judiStats?.puntos ?? 0

    const rankBeatPct =
        userRank !== null && totalRankedUsers > 1
            ? Math.round(((totalRankedUsers - userRank) / (totalRankedUsers - 1)) * 100)
            : null

    const judiKpis = [
        { label: 'puntos', value: puntos.toLocaleString('es-ES') },
        { label: 'en el ranking', value: userRank !== null ? `${userRank}º` : '—' },
        { label: 'partidas', value: (judiStats?.total ?? 0).toLocaleString('es-ES') },
        { label: 'aciertos', value: (judiStats?.aciertos ?? 0).toLocaleString('es-ES') },
        { label: 'fallos', value: (judiStats?.fallos ?? 0).toLocaleString('es-ES') },
        { label: 'de precisión', value: `${judiStats?.porcentaje_acierto ?? 0} %` },
    ]

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
                            transition={{ duration: 0.15 }}
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
                            transition={{ duration: 0.15 }}
                        >
                            <CheckCircle size={15} aria-hidden /> {success}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <header className="page-head pf-head">
                <div className="pf-who">
                    <span className="pf-avatar" aria-hidden>
                        {initial}
                    </span>
                    <div>
                        <h1 className="page-title pf-who__name">
                            {displayName}
                            {user?.user_metadata?.administrador && <span className="hg-chip">Admin</span>}
                        </h1>
                        <p className="pf-who__email">{user?.email}</p>
                    </div>
                </div>
            </header>

            <div className="pf-grid">
                <div className="pf-main">
                    <section className="pf-section" aria-labelledby="pf-account">
                        <h2 id="pf-account" className="pf-section__title">
                            Cuenta
                        </h2>
                        <div className="pf-rows">
                            <form onSubmit={handleUpdateUsername} className="pf-row">
                                <div className="pf-row__text">
                                    <label className="pf-row__label" htmlFor="perfil-username-input">
                                        Nombre de usuario
                                    </label>
                                    <p className="pf-row__desc">Es el nombre que aparece en el ranking.</p>
                                </div>
                                <div className="pf-row__control pf-row__control--form">
                                    <Input
                                        id="perfil-username-input"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Tu nombre"
                                        autoComplete="username"
                                    />
                                    <Button type="submit" variant="secondary" disabled={updating}>
                                        Guardar
                                    </Button>
                                </div>
                            </form>

                            <form onSubmit={handleUpdatePassword} className="pf-row">
                                <div className="pf-row__text">
                                    <span className="pf-row__label" id="pf-pass-label">
                                        Contraseña
                                    </span>
                                    <p className="pf-row__desc">Mínimo 6 caracteres.</p>
                                </div>
                                <div className="pf-row__control pf-row__control--stack" role="group" aria-labelledby="pf-pass-label">
                                    <label htmlFor="perfil-pass-new" className="sr-only">Nueva contraseña</label>
                                    <Input
                                        id="perfil-pass-new"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Nueva contraseña"
                                        autoComplete="new-password"
                                    />
                                    <label htmlFor="perfil-pass-confirm" className="sr-only">Confirmar contraseña</label>
                                    <Input
                                        id="perfil-pass-confirm"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirmar contraseña"
                                        autoComplete="new-password"
                                    />
                                    <Button type="submit" variant="secondary" disabled={updating}>
                                        Cambiar contraseña
                                    </Button>
                                </div>
                            </form>

                            <div className="pf-row pf-row--inline">
                                <div className="pf-row__text">
                                    <span className="pf-row__label">Sesión</span>
                                    <p className="pf-row__desc">Cierra la sesión en este dispositivo.</p>
                                </div>
                                <div className="pf-row__control">
                                    <Button variant="secondary" onClick={handleLogout}>
                                        <LogOut size={15} data-icon="inline-start" aria-hidden /> Cerrar sesión
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <Suspense fallback={null}>
                        <SteamSetting />
                    </Suspense>

                    <section className="pf-section" aria-labelledby="pf-prefs">
                        <h2 id="pf-prefs" className="pf-section__title">
                            Preferencias
                        </h2>
                        <div className="pf-rows">
                            <div className="pf-row pf-row--inline">
                                <div className="pf-row__text">
                                    <span className="pf-row__label">Tema</span>
                                    <p className="pf-row__desc">Claro, oscuro o el que use tu sistema.</p>
                                </div>
                                <div className="pf-row__control">
                                    <ThemeToggle labeled />
                                </div>
                            </div>
                            <div className="pf-row pf-row--inline">
                                <div className="pf-row__text">
                                    <span className="pf-row__label" id="pf-notif-label">
                                        Notificaciones
                                    </span>
                                    <p className="pf-row__desc">
                                        {notificationsLoading ? 'Actualizando…' : 'Nuevo JUDI cada día y bajadas de precio de tu wishlist.'}
                                    </p>
                                </div>
                                <div className="pf-row__control">
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={Boolean(notificationsEnabled)}
                                        aria-labelledby="pf-notif-label"
                                        disabled={notificationsLoading || notificationsEnabled === null}
                                        className="switch"
                                        onClick={handleToggleNotifications}
                                    >
                                        <span className="switch__thumb" aria-hidden />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <ExportSetting />
                </div>

                <aside className="pf-aside">
                    <section className="pf-section" aria-labelledby="pf-judi">
                        <div className="pf-section__head">
                            <h2 id="pf-judi" className="pf-section__title">
                                Tu JUDI
                            </h2>
                            <Link href="/ranking" className="pf-section__link">
                                Ver el ranking
                            </Link>
                        </div>
                        <div className="pf-judi">
                            <dl className="pf-kpis">
                                {judiKpis.map((k) => (
                                    <div key={k.label} className="pf-kpi">
                                        <dt>{k.label}</dt>
                                        <dd>{k.value}</dd>
                                    </div>
                                ))}
                            </dl>
                            <p className="pf-judi__beat">
                                {rankBeatPct !== null
                                    ? `Superas al ${rankBeatPct} % de los jugadores de JUDI.`
                                    : totalRankedUsers === 0
                                        ? 'Aún no hay clasificación.'
                                        : 'Termina partidas para aparecer en el ranking.'}
                            </p>
                        </div>
                    </section>

                    <section className="pf-section" aria-labelledby="pf-top">
                        <h2 id="pf-top" className="pf-section__title">
                            Mejores jugadores
                        </h2>
                        <ol className="pf-top">
                            {leaderboardPreview.map((player, index) => (
                                <li key={player.userId} className={`pf-top__row${player.userId === user?.id ? ' is-self' : ''}`}>
                                    <span className={`pf-top__rank${index < 3 ? ` pf-top__rank--${index + 1}` : ''}`}>{index + 1}</span>
                                    <span className="pf-top__name">{player.username}</span>
                                    <span className="pf-top__pts">
                                        {player.points.toLocaleString('es-ES')} <small>pts</small>
                                    </span>
                                </li>
                            ))}
                            {leaderboardPreview.length === 0 && <li className="pf-top__empty">Sin datos de ranking.</li>}
                        </ol>
                    </section>
                </aside>
            </div>
        </div>
    )
}

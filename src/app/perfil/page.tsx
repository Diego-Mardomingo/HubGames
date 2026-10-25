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
import {
    Trophy, Medal, Bell, BellOff, Save, Shield, KeyRound,
    LogOut, Target, XCircle, Gamepad2,
    AlertTriangle, CheckCircle, ChevronRight, User,
} from 'lucide-react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import Loader from '@/components/Loader'
import { CountUp, ProgressRing } from '@/components/motion'
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
    const medalColors = ['#fcd34d', '#cbd5e1', '#f0a868']
    const puntos = judiStats?.puntos ?? 0

    const rankBeatPct =
        userRank !== null && totalRankedUsers > 1
            ? Math.round(((totalRankedUsers - userRank) / (totalRankedUsers - 1)) * 100)
            : null

    const gridStats = [
        { icon: <Gamepad2 size={17} />, label: 'Partidas', value: judiStats?.total ?? 0, tone: 'violet' },
        { icon: <Target size={17} />, label: 'Aciertos', value: judiStats?.aciertos ?? 0, tone: 'green' },
        { icon: <XCircle size={17} />, label: 'Fallos', value: judiStats?.fallos ?? 0, tone: 'red' },
    ]

    const ease = [0.22, 1, 0.36, 1] as const

    return (
        <div className="perfil">
            <div className="toasts" aria-live="polite">
                <AnimatePresence>
                    {error && (
                        <motion.div
                            key={`e-${error}`}
                            className="alert alert--error toast"
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        >
                            <AlertTriangle size={15} /> {error}
                        </motion.div>
                    )}
                    {success && (
                        <motion.div
                            key={`s-${success}`}
                            className="alert alert--ok toast"
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        >
                            <CheckCircle size={15} /> {success}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="perfil-grid">
                {/* Tarjeta de jugador */}
                <motion.section
                    className="player-card glass"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease }}
                >
                    <div className="player-card__banner" aria-hidden />
                    <motion.div
                        className="player-card__avatar"
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.15 }}
                    >
                        <span>{initial}</span>
                    </motion.div>
                    <h1 className="player-card__name">
                        {displayName}
                        {user?.user_metadata?.administrador && (
                            <span className="player-card__admin">
                                <Shield size={10} /> Admin
                            </span>
                        )}
                    </h1>
                    <p className="player-card__email">{user?.email}</p>

                    <div className="player-card__rank">
                        <div>
                            <span className="player-card__k">Posición</span>
                            <span className="player-card__v player-card__v--gold">#{userRank ?? '—'}</span>
                        </div>
                        <span className="player-card__sep" aria-hidden />
                        <div>
                            <span className="player-card__k">Puntos</span>
                            <CountUp value={puntos} className="player-card__v text-gradient" />
                        </div>
                    </div>
                    <p className="player-card__beat">
                        {rankBeatPct !== null
                            ? `Superas al ${rankBeatPct}% de jugadores de JUDI`
                            : totalRankedUsers === 0
                                ? 'Aún no hay clasificación'
                                : 'Termina partidas para aparecer en el ranking'}
                    </p>

                    <Button variant="secondary" className="player-card__logout" onClick={handleLogout}>
                        <LogOut size={15} data-icon="inline-start" aria-hidden /> Cerrar sesión
                    </Button>
                </motion.section>

                <div className="perfil-main">
                    {/* Rendimiento */}
                    <motion.section
                        className="perf glass"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease, delay: 0.08 }}
                    >
                        <ProgressRing value={judiStats?.porcentaje_acierto ?? 0} size={132} stroke={11}>
                            <div className="perf__ring-center">
                                <CountUp value={judiStats?.porcentaje_acierto ?? 0} suffix="%" className="perf__ring-value" />
                                <span className="perf__ring-label">Precisión</span>
                            </div>
                        </ProgressRing>
                        <div className="perf__stats">
                            {gridStats.map((s, i) => (
                                <motion.div
                                    key={s.label}
                                    className={`perf__stat perf__stat--${s.tone}`}
                                    initial={{ opacity: 0, x: 12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.45, ease, delay: 0.2 + i * 0.07 }}
                                >
                                    <span className="perf__stat-icon">{s.icon}</span>
                                    <span className="perf__stat-label">{s.label}</span>
                                    <CountUp value={s.value} className="perf__stat-value" />
                                </motion.div>
                            ))}
                        </div>
                    </motion.section>

                    {/* Top jugadores */}
                    <motion.section
                        className="top glass"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease, delay: 0.16 }}
                    >
                        <div className="section-head">
                            <h2 className="section-head__title">
                                <Trophy size={15} aria-hidden /> Top jugadores
                            </h2>
                            <Link href="/ranking" className="section-head__link">
                                Ver ranking <ChevronRight size={14} />
                            </Link>
                        </div>
                        <ul className="top__list">
                            {leaderboardPreview.map((player, index) => (
                                <motion.li
                                    key={player.userId}
                                    className={`top__row${player.userId === user?.id ? ' is-self' : ''}`}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.35, delay: 0.25 + index * 0.05 }}
                                >
                                    <span
                                        className="top__medal"
                                        style={{
                                            background: index < 3 ? `${medalColors[index]}22` : 'rgba(255,255,255,0.05)',
                                            color: index < 3 ? medalColors[index] : 'var(--muted)',
                                        }}
                                    >
                                        {index < 3 ? <Medal size={13} /> : index + 1}
                                    </span>
                                    <span className="top__name">{player.username}</span>
                                    <span className="top__pts">{player.points} pts</span>
                                </motion.li>
                            ))}
                            {leaderboardPreview.length === 0 && <li className="top__empty">Sin datos de ranking</li>}
                        </ul>
                    </motion.section>
                </div>
            </div>

            {/* Ajustes */}
            <section className="settings" aria-label="Ajustes de cuenta">
                <h2 className="settings__title">Ajustes</h2>
                <div className="settings__grid">
                    <motion.div
                        className="setting glass"
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, ease }}
                    >
                        <div className="setting__head">
                            <span className={`setting__icon ${notificationsEnabled ? '' : 'is-muted'}`} aria-hidden>
                                {notificationsEnabled ? <Bell size={17} /> : <BellOff size={17} />}
                            </span>
                            <div className="setting__text">
                                <p className="setting__title">Notificaciones</p>
                                <p className="setting__desc">
                                    {notificationsLoading ? 'Actualizando…' : 'Nuevo JUDI cada día y bajadas de precio de tu wishlist'}
                                </p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={Boolean(notificationsEnabled)}
                                aria-label="Notificaciones"
                                disabled={notificationsLoading || notificationsEnabled === null}
                                className="switch"
                                onClick={handleToggleNotifications}
                            >
                                <span className="switch__thumb" aria-hidden />
                            </button>
                        </div>
                    </motion.div>

                    <motion.div
                        className="setting glass"
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, ease, delay: 0.06 }}
                    >
                        <div className="setting__head">
                            <span className="setting__icon" aria-hidden>
                                <User size={17} />
                            </span>
                            <div className="setting__text">
                                <p className="setting__title">Nombre de usuario</p>
                                <p className="setting__desc">Es el nombre que aparece en el ranking</p>
                            </div>
                        </div>
                        <form onSubmit={handleUpdateUsername} className="setting__form">
                            <Input
                                id="perfil-username-input"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Tu nombre"
                                autoComplete="username"
                            />
                            <Button type="submit" disabled={updating}>
                                <Save size={14} data-icon="inline-start" aria-hidden /> Guardar
                            </Button>
                        </form>
                    </motion.div>

                    <motion.div
                        className="setting glass"
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, ease, delay: 0.12 }}
                    >
                        <div className="setting__head">
                            <span className="setting__icon" aria-hidden>
                                <KeyRound size={17} />
                            </span>
                            <div className="setting__text">
                                <p className="setting__title">Contraseña</p>
                                <p className="setting__desc">Mínimo 6 caracteres</p>
                            </div>
                        </div>
                        <form onSubmit={handleUpdatePassword} className="setting__form setting__form--stack">
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
                                <KeyRound size={14} data-icon="inline-start" aria-hidden /> Actualizar
                            </Button>
                        </form>
                    </motion.div>

                    <Suspense fallback={null}>
                        <SteamSetting />
                    </Suspense>

                    <ExportSetting />
                </div>
            </section>
        </div>
    )
}

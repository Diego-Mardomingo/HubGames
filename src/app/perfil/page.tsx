'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import { getNotificationPreference, subscribeToDailyNotifications, disableDailyNotifications } from '@/lib/notifications'
import { buildRanking, getPointsForRecord, type JudiProgressRecord } from '@/lib/judi-ranking'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Trophy, Medal, Bell, BellOff, Save, Shield, KeyRound,
    LogOut, Target, XCircle, Percent, Gamepad2,
    AlertTriangle, CheckCircle, ChevronRight, User,
} from 'lucide-react'
import Link from 'next/link'

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
        const { data: records, error: leaderboardError } = await supabase
            .from('hubgames_judi_fases_usuario')
            .select('id_usuario, completado, fase1, fase2, fase3, fase4, fase5, fase6, hubgames_usuarios(username)')
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

    if (loading) return <div className="loader-container"><div className="loader" /></div>

    const initial = (user?.user_metadata?.username || user?.email || 'U')[0].toUpperCase()
    const displayName = (user?.user_metadata?.username || 'Usuario').toUpperCase()
    const medalColors = ['#fbbf24', '#94a3b8', '#cd7f32']
    const puntos = judiStats?.puntos ?? 0

    const rankBeatPct =
        userRank !== null && totalRankedUsers > 1
            ? Math.round(((totalRankedUsers - userRank) / (totalRankedUsers - 1)) * 100)
            : null

    const gridStats = [
        { icon: <Gamepad2 size={18} />, label: 'Partidas', value: judiStats?.total ?? 0, accent: 'cyan' as const },
        { icon: <Target size={18} />, label: 'Aciertos', value: judiStats?.aciertos ?? 0, accent: 'cyan' as const },
        { icon: <XCircle size={18} />, label: 'Fallos', value: judiStats?.fallos ?? 0, accent: 'red' as const },
        { icon: <Percent size={18} />, label: 'Efectividad', value: `${judiStats?.porcentaje_acierto ?? 0}%`, accent: 'gold' as const },
    ]

    return (
        <div className="perfil-boceto animate-fade-in-up">
            {error && (
                <div className="perfil-boceto-alert perfil-boceto-alert--err">
                    <AlertTriangle size={14} /> {error}
                </div>
            )}
            {success && (
                <div className="perfil-boceto-alert perfil-boceto-alert--ok">
                    <CheckCircle size={14} /> {success}
                </div>
            )}

            <header className="perfil-boceto-topbar">
                <div className="perfil-boceto-topbar__mini-avatar" aria-hidden>{initial}</div>
                <h1 className="perfil-boceto-topbar__title">MI PERFIL</h1>
                <button
                    type="button"
                    className="perfil-boceto-topbar__logout-ico"
                    onClick={handleLogout}
                    aria-label="Cerrar sesión"
                >
                    <LogOut size={18} strokeWidth={2.25} />
                </button>
            </header>

            <section className="perfil-boceto-hero">
                <div className="perfil-boceto-hero__avatar-box">
                    <div className="perfil-boceto-hero__avatar">{initial}</div>
                    <span className="perfil-boceto-hero__lvl">{puntos} pts</span>
                </div>
                <h2 className="perfil-boceto-hero__name">
                    {displayName}
                    {user?.user_metadata?.administrador && (
                        <span className="perfil-boceto-hero__admin"><Shield size={10} /> Admin</span>
                    )}
                </h2>
                <p className="perfil-boceto-hero__email">{user?.email}</p>
            </section>

            <section className="perfil-boceto-rank-card">
                <div className="perfil-boceto-rank-card__stripe" aria-hidden />
                <div className="perfil-boceto-rank-card__col perfil-boceto-rank-card__col--rank">
                    <span className="perfil-boceto-rank-card__hash">#{userRank ?? '—'}</span>
                    <span className="perfil-boceto-rank-card__rank-label">RANK</span>
                </div>
                <div className="perfil-boceto-rank-card__col perfil-boceto-rank-card__col--mid">
                    <p className="perfil-boceto-rank-card__kicker">TU POSICIÓN ACTUAL</p>
                    <p className="perfil-boceto-rank-card__sub">
                        {rankBeatPct !== null
                            ? `Superando al ${rankBeatPct}% de jugadores en JUDI`
                            : totalRankedUsers === 0
                                ? 'Aún no hay clasificación'
                                : 'Juega partidas para aparecer en el ranking'}
                    </p>
                </div>
                <div className="perfil-boceto-rank-card__col perfil-boceto-rank-card__col--pts">
                    <span className="perfil-boceto-rank-card__pts-num">{puntos}</span>
                    <span className="perfil-boceto-rank-card__pts-label">PUNTOS TOTALES</span>
                </div>
            </section>

            <section className="perfil-boceto-points-card">
                <div className="perfil-boceto-points-card__icon-wrap" aria-hidden>
                    <Trophy size={22} strokeWidth={2} />
                </div>
                <div className="perfil-boceto-points-card__text">
                    <p className="perfil-boceto-points-card__label">PUNTOS ACUMULADOS</p>
                    <p className="perfil-boceto-points-card__value">{puntos}</p>
                </div>
            </section>

            <div className="perfil-boceto-stat-grid">
                {gridStats.map((s) => (
                    <div key={s.label} className={`perfil-boceto-stat-tile perfil-boceto-stat-tile--${s.accent}`}>
                        <div className="perfil-boceto-stat-tile__icon">{s.icon}</div>
                        <span className="perfil-boceto-stat-tile__label">{s.label}</span>
                        <span className="perfil-boceto-stat-tile__value">{s.value}</span>
                    </div>
                ))}
            </div>

            <section className="perfil-boceto-ranking-preview">
                <div className="perfil-boceto-ranking-preview__head">
                    <span className="perfil-boceto-ranking-preview__title">Top jugadores</span>
                    <Link href="/ranking" className="perfil-boceto-ranking-preview__link">
                        Ver ranking <ChevronRight size={14} />
                    </Link>
                </div>
                <ul className="perfil-boceto-ranking-preview__list">
                    {leaderboardPreview.map((player, index) => (
                        <li key={player.userId} className="perfil-boceto-ranking-preview__row">
                            <span
                                className="perfil-boceto-ranking-preview__medal"
                                style={{
                                    background: index < 3 ? `${medalColors[index]}22` : 'var(--surface-3)',
                                    color: index < 3 ? medalColors[index] : 'var(--muted)',
                                }}
                            >
                                {index < 3 ? <Medal size={12} /> : index + 1}
                            </span>
                            <span className="perfil-boceto-ranking-preview__name">{player.username}</span>
                            <span className="perfil-boceto-ranking-preview__pts">{player.points} pts</span>
                        </li>
                    ))}
                    {leaderboardPreview.length === 0 && (
                        <li className="perfil-boceto-ranking-preview__empty">Sin datos de ranking</li>
                    )}
                </ul>
            </section>

            <section className="perfil-boceto-settings" aria-label="Ajustes de cuenta">
                <div className="perfil-boceto-settings__stack">
                    {/* Preferencias */}
                    <div className="perfil-boceto-settings__group">
                        <h3 className="perfil-boceto-settings__cat">Preferencias</h3>
                        <div className="perfil-boceto-settings__card">
                            <div className="perfil-boceto-settings__row">
                                <div className="perfil-boceto-settings__row-left">
                                    <div className={`perfil-boceto-settings__ico ${notificationsEnabled ? '' : 'perfil-boceto-settings__ico--muted'}`} aria-hidden>
                                        {notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
                                    </div>
                                    <div>
                                        <p className="perfil-boceto-settings__row-title">Notificaciones</p>
                                        <p className="perfil-boceto-settings__row-desc">
                                            {notificationsLoading ? 'Actualizando…' : 'Alertas del juego diario (JUDI)'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={Boolean(notificationsEnabled)}
                                    aria-label="Notificaciones"
                                    disabled={notificationsLoading || notificationsEnabled === null}
                                    className="perfil-notify-switch"
                                    onClick={handleToggleNotifications}
                                >
                                    <span className="perfil-notify-switch__thumb" aria-hidden />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Identidad */}
                    <div className="perfil-boceto-settings__group">
                        <h3 className="perfil-boceto-settings__cat">Identidad</h3>
                        <div className="perfil-boceto-settings__card perfil-boceto-settings__card--pad">
                            <div className="perfil-boceto-settings__block-head">
                                <User size={17} className="perfil-boceto-settings__head-ico" aria-hidden />
                                <span className="perfil-boceto-settings__block-title">Nombre de usuario</span>
                            </div>
                            <form onSubmit={handleUpdateUsername} className="perfil-boceto-settings__form-col">
                                <Input
                                    id="perfil-username-input"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Tu nombre"
                                    autoComplete="username"
                                    className="perfil-settings-input perfil-boceto-settings__input"
                                />
                                <Button type="submit" disabled={updating} className="perfil-boceto-settings__save-btn">
                                    <Save size={14} data-icon="inline-start" aria-hidden /> Guardar
                                </Button>
                            </form>
                        </div>
                    </div>

                    {/* Seguridad */}
                    <div className="perfil-boceto-settings__group">
                        <h3 className="perfil-boceto-settings__cat">Seguridad</h3>
                        <div className="perfil-boceto-settings__card perfil-boceto-settings__card--pad">
                            <div className="perfil-boceto-settings__block-head">
                                <KeyRound size={17} className="perfil-boceto-settings__head-ico" aria-hidden />
                                <span className="perfil-boceto-settings__block-title">Contraseña</span>
                            </div>
                            <form onSubmit={handleUpdatePassword} className="perfil-boceto-settings__form-col">
                                <div className="perfil-boceto-settings__field">
                                    <label htmlFor="perfil-pass-new" className="perfil-boceto-settings__field-label">Nueva contraseña</label>
                                    <Input
                                        id="perfil-pass-new"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        autoComplete="new-password"
                                        className="perfil-settings-input perfil-boceto-settings__input"
                                    />
                                </div>
                                <div className="perfil-boceto-settings__field">
                                    <label htmlFor="perfil-pass-confirm" className="perfil-boceto-settings__field-label">Confirmar</label>
                                    <Input
                                        id="perfil-pass-confirm"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        autoComplete="new-password"
                                        className="perfil-settings-input perfil-boceto-settings__input"
                                    />
                                </div>
                                <Button type="submit" disabled={updating} variant="outline" className="perfil-boceto-settings__update-btn">
                                    <KeyRound size={14} data-icon="inline-start" aria-hidden /> Actualizar
                                </Button>
                            </form>
                        </div>
                    </div>
                </div>
            </section>

            <button type="button" className="perfil-boceto-logout-bar" onClick={handleLogout}>
                CERRAR SESIÓN
            </button>
        </div>
    )
}

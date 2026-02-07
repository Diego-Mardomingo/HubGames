'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Loader from '@/components/Loader'

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

    useEffect(() => {
        checkUser()
    }, [])

    const checkUser = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                router.push('/login')
                return
            }

            setUser(session.user)
            setUsername(session.user.user_metadata?.username || '')

            // Fetch JUDI stats
            await fetchJudiStats(session.user.id)

            setLoading(false)
        } catch (err) {
            console.error('Error checking user:', err)
            router.push('/login')
        }
    }

    const fetchJudiStats = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('hubgames_judi_fases_usuario')
                .select('completado')
                .eq('id_usuario', userId)

            if (error) throw error

            const aciertos = data?.filter(fase => fase.completado).length || 0
            const fallos = data?.filter(fase => !fase.completado).length || 0
            const total = aciertos + fallos
            const porcentaje_acierto = total > 0 ? Math.round((aciertos / total) * 100) : 0

            setJudiStats({
                aciertos,
                fallos,
                total,
                porcentaje_acierto
            })
        } catch (err) {
            console.error('Error fetching JUDI stats:', err)
            setJudiStats({ aciertos: 0, fallos: 0, total: 0, porcentaje_acierto: 0 })
        }
    }

    const handleUpdateUsername = async (e: React.FormEvent) => {
        e.preventDefault()
        setUpdating(true)
        setError('')
        setSuccess('')

        try {
            // Update auth metadata
            const { error: authError } = await supabase.auth.updateUser({
                data: { username }
            })

            if (authError) throw authError

            // Update hubgames_usuarios table
            const { error: dbError } = await supabase
                .from('hubgames_usuarios')
                .update({ username })
                .eq('id', user.id)

            if (dbError) throw dbError

            setSuccess('¡Username actualizado correctamente!')

            // Refresh user data
            await checkUser()
        } catch (err: any) {
            setError(err.message || 'Error al actualizar el username')
        } finally {
            setUpdating(false)
        }
    }

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setUpdating(true)
        setError('')
        setSuccess('')

        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden')
            setUpdating(false)
            return
        }

        if (newPassword.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres')
            setUpdating(false)
            return
        }

        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            })

            if (error) throw error

            setSuccess('¡Contraseña actualizada correctamente!')
            setNewPassword('')
            setConfirmPassword('')
        } catch (err: any) {
            setError(err.message || 'Error al actualizar la contraseña')
        } finally {
            setUpdating(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/')
    }

    if (loading) {
        return (
            <div className="cuerpo">
                <Loader />
            </div>
        )
    }

    return (
        <div className="cuerpo" style={{ padding: '2rem 1rem', maxWidth: '1200px', margin: '2em auto' }}>
            <div className="encabezado" style={{
                textAlign: 'center',
                marginBottom: '3em',
                background: 'transparent',
                color: '#fff',
            }}>
                <h1 style={{ margin: 0, color: '#00A8E8', fontSize: '3em', fontWeight: 800, letterSpacing: '-1px', textTransform: 'uppercase' }}>Mi Perfil</h1>
                <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: '0.5rem', fontSize: '1.1rem' }}>Gestiona tu cuenta y revisa tus logros</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2.5rem', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    {/* User Info */}
                    <div className="glass-panel" style={{
                        padding: '2.5em',
                        borderRadius: '24px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div style={{
                                width: '70px',
                                height: '70px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #00A8E8, #007EA7)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '2rem',
                                color: '#fff',
                                fontWeight: 800,
                                boxShadow: '0 0 20px rgba(0, 168, 232, 0.4)'
                            }}>
                                {(user?.user_metadata?.username || user?.email || '?')[0].toUpperCase()}
                            </div>
                            <div>
                                <h2 style={{ margin: 0, color: '#fff', fontSize: '1.5rem', fontWeight: 700 }}>{user?.user_metadata?.username || 'Usuario'}</h2>
                                <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>{user?.email}</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', color: 'rgba(255,255,255,0.7)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontWeight: 600 }}>Miembro desde</span>
                                <span style={{ color: '#fff' }}>{new Date(user?.created_at).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
                            </div>
                            {user?.user_metadata?.administrador && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 600 }}>Rol</span>
                                    <span style={{ color: '#00A8E8', fontWeight: 800 }}>ADMINISTRADOR</span>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleLogout}
                            className="btn-secondary"
                            style={{
                                width: '100%',
                                marginTop: '2.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.8rem',
                                minHeight: '50px',
                                background: 'rgba(255, 71, 87, 0.05)',
                                color: '#ff4757',
                                border: '1px solid rgba(255, 71, 87, 0.1)',
                                borderRadius: '12px',
                                fontWeight: 700,
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <i className="fa-solid fa-right-from-bracket"></i>
                            Cerrar Sesión
                        </button>
                    </div>

                    {/* Settings */}
                    <div className="glass-panel" style={{
                        padding: '2.5em',
                        borderRadius: '24px',
                    }}>
                        <h2 style={{ marginTop: 0, marginBottom: '2rem', color: '#00A8E8', fontSize: '1.4rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Ajustes</h2>

                        <form onSubmit={handleUpdateUsername} style={{ marginBottom: '2.5rem' }}>
                            <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginBottom: '0.6rem', fontWeight: 600, paddingLeft: '0.5rem' }}>NUEVO USERNAME</label>
                            <div style={{ position: 'relative', marginBottom: '1rem' }}>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '1em 1em 1em 3.2em',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        fontSize: '1em',
                                        backgroundColor: 'rgba(10, 20, 30, 0.4)',
                                        color: '#fff',
                                        outline: 'none'
                                    }}
                                    placeholder="Username"
                                />
                                <i className="fa-solid fa-user" style={{ position: 'absolute', left: '1.2em', top: '50%', transform: 'translateY(-50%)', color: '#00A8E8', opacity: 0.7 }}></i>
                            </div>
                            <button type="submit" className="btn-primary" disabled={updating} style={{ width: '100%', borderRadius: '12px', minHeight: '48px' }}>
                                {updating ? <span className="loader" style={{ width: '20px', height: '20px' }}></span> : 'Guardar cambios'}
                            </button>
                        </form>

                        <form onSubmit={handleUpdatePassword}>
                            <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginBottom: '0.6rem', fontWeight: 600, paddingLeft: '0.5rem' }}>CAMBIAR CONTRASEÑA</label>
                            <div style={{ position: 'relative', marginBottom: '1rem' }}>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '1em 1em 1em 3.2em',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        fontSize: '1em',
                                        backgroundColor: 'rgba(10, 20, 30, 0.4)',
                                        color: '#fff',
                                        outline: 'none'
                                    }}
                                    placeholder="Nueva contraseña"
                                />
                                <i className="fa-solid fa-key" style={{ position: 'absolute', left: '1.2em', top: '50%', transform: 'translateY(-50%)', color: '#00A8E8', opacity: 0.7 }}></i>
                            </div>
                            <div style={{ position: 'relative', marginBottom: '1rem' }}>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '1em 1em 1em 3.2em',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        fontSize: '1em',
                                        backgroundColor: 'rgba(10, 20, 30, 0.4)',
                                        color: '#fff',
                                        outline: 'none'
                                    }}
                                    placeholder="Confirmar contraseña"
                                />
                                <i className="fa-solid fa-key" style={{ position: 'absolute', left: '1.2em', top: '50%', transform: 'translateY(-50%)', color: '#00A8E8', opacity: 0.7 }}></i>
                            </div>
                            <button type="submit" className="btn-primary" disabled={updating} style={{ width: '100%', borderRadius: '12px', minHeight: '48px' }}>
                                {updating ? <span className="loader" style={{ width: '20px', height: '20px' }}></span> : 'Actualizar contraseña'}
                            </button>
                        </form>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    {/* JUDI Stats */}
                    {judiStats && (
                        <div className="glass-panel" style={{
                            padding: '2.5em',
                            borderRadius: '24px',
                            minHeight: '100%'
                        }}>
                            <h2 style={{
                                marginTop: 0,
                                marginBottom: '2rem',
                                color: '#00A8E8',
                                fontSize: '1.4rem',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.8rem',
                                textTransform: 'uppercase',
                                letterSpacing: '1px'
                            }}>
                                <i className="fa-solid fa-trophy" style={{ color: '#FFD700' }}></i>
                                Estadísticas JUDI
                            </h2>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '1.2rem',
                                marginBottom: '2.5rem'
                            }}>
                                <div style={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                    padding: '1.5rem',
                                    borderRadius: '16px',
                                    textAlign: 'center',
                                    border: '1px solid rgba(255, 255, 255, 0.05)'
                                }}>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#00D9FF', lineHeight: 1 }}>
                                        {judiStats.total}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', marginTop: '0.6rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase' }}>Partidas</div>
                                </div>

                                <div style={{
                                    backgroundColor: 'rgba(46, 213, 115, 0.05)',
                                    padding: '1.5rem',
                                    borderRadius: '16px',
                                    textAlign: 'center',
                                    border: '1px solid rgba(46, 213, 115, 0.1)'
                                }}>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#2ed573', lineHeight: 1 }}>
                                        {judiStats.aciertos}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', marginTop: '0.6rem', color: 'rgba(46, 213, 115, 0.5)', fontWeight: 700, textTransform: 'uppercase' }}>Victorias</div>
                                </div>
                            </div>

                            <div style={{ marginBottom: '2rem' }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'baseline',
                                    marginBottom: '1rem'
                                }}>
                                    <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: '0.9rem' }}>Tasa de éxito</span>
                                    <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#00A8E8' }}>
                                        {judiStats.porcentaje_acierto}%
                                    </span>
                                </div>

                                <div style={{
                                    width: '100%',
                                    height: '12px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: '10px',
                                    overflow: 'hidden',
                                    position: 'relative'
                                }}>
                                    <div style={{
                                        width: `${judiStats.porcentaje_acierto}%`,
                                        height: '100%',
                                        background: 'linear-gradient(90deg, #00A8E8, #00D9FF)',
                                        borderRadius: '10px',
                                        boxShadow: '0 0 15px rgba(0, 168, 232, 0.5)',
                                        transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }}></div>
                                </div>
                            </div>

                            <div style={{
                                padding: '1.5rem',
                                background: 'rgba(0, 168, 232, 0.05)',
                                borderRadius: '16px',
                                border: '1px solid rgba(0, 168, 232, 0.1)',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                                    {judiStats.porcentaje_acierto >= 70 ? '👑' :
                                        judiStats.porcentaje_acierto >= 40 ? '🎮' : '💪'}
                                </div>
                                <p style={{ margin: 0, fontWeight: 700, color: '#fff' }}>
                                    {judiStats.porcentaje_acierto >= 70 ? 'Nivel: Maestro de los Juegos' :
                                        judiStats.porcentaje_acierto >= 40 ? 'Nivel: Jugador Habitual' :
                                            judiStats.total === 0 ? '¡Empieza tu aventura JUDI!' : 'Nivel: Aspirante'}
                                </p>
                                <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'rgba(0, 168, 232, 0.6)' }}>
                                    {judiStats.porcentaje_acierto >= 70 ? 'Tu conocimiento es legendario.' :
                                        judiStats.porcentaje_acierto >= 40 ? 'Dominas bien la industria.' :
                                            'Sigue jugando para mejorar.'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Notifications */}
            <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', zIndex: 1000 }}>
                {error && (
                    <div className="glass-panel" style={{
                        padding: '1rem 2rem',
                        background: 'rgba(255, 71, 87, 0.1)',
                        border: '1px solid #ff4757',
                        color: '#ff4757',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.8rem',
                        fontWeight: 600,
                        animation: 'fadeInUp 0.3s ease'
                    }}>
                        <i className="fa-solid fa-circle-exclamation"></i> {error}
                    </div>
                )}
                {success && (
                    <div className="glass-panel" style={{
                        padding: '1rem 2rem',
                        background: 'rgba(46, 213, 115, 0.1)',
                        border: '1px solid #2ed573',
                        color: '#2ed573',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.8rem',
                        fontWeight: 600,
                        animation: 'fadeInUp 0.3s ease'
                    }}>
                        <i className="fa-solid fa-circle-check"></i> {success}
                    </div>
                )}
            </div>

            <style jsx>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    )
}

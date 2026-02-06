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
            setLoading(false)
        } catch (err) {
            console.error('Error checking user:', err)
            router.push('/login')
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
        <div className="cuerpo">
            <h1 style={{ textAlign: 'center', marginBottom: '1em', color: '#00171F' }}>
                Mi Perfil
            </h1>

            <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                {/* User Info */}
                <div style={{
                    backgroundColor: 'rgba(0, 23, 31, 0.8)',
                    color: '#fff',
                    padding: '1.5em',
                    borderRadius: '5px',
                    marginBottom: '2em'
                }}>
                    <h2 style={{ marginTop: 0, marginBottom: '1em' }}>Información de la Cuenta</h2>
                    <p><strong>Email:</strong> {user?.email}</p>
                    <p><strong>Username:</strong> {user?.user_metadata?.username || 'No establecido'}</p>
                    <p><strong>Cuenta creada:</strong> {new Date(user?.created_at).toLocaleDateString('es-ES')}</p>
                    {user?.user_metadata?.administrador && (
                        <p style={{ color: '#00A8E8' }}><strong>Rol:</strong> Administrador</p>
                    )}
                </div>

                {/* Update Username */}
                <div style={{
                    backgroundColor: 'rgba(250, 250, 250, 0.9)',
                    padding: '1.5em',
                    borderRadius: '5px',
                    marginBottom: '2em'
                }}>
                    <h2 style={{ marginTop: 0, marginBottom: '1em', color: '#00171F' }}>Cambiar Username</h2>
                    <form onSubmit={handleUpdateUsername}>
                        <div style={{ position: 'relative', marginBottom: '1em' }}>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                style={{
                                    width: '100%',
                                    padding: '0.75em',
                                    paddingLeft: '2.5em',
                                    borderRadius: '5px',
                                    border: '2px solid #00171F',
                                    fontSize: '1em',
                                }}
                                placeholder="Nuevo username"
                            />
                            <i
                                className="fa-solid fa-user"
                                style={{ position: 'absolute', left: '0.8em', top: '50%', transform: 'translateY(-50%)', color: '#00171F' }}
                            ></i>
                        </div>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={updating}
                            style={{ width: '100%' }}
                        >
                            {updating ? 'Actualizando...' : 'Actualizar Username'}
                        </button>
                    </form>
                </div>

                {/* Update Password */}
                <div style={{
                    backgroundColor: 'rgba(250, 250, 250, 0.9)',
                    padding: '1.5em',
                    borderRadius: '5px',
                    marginBottom: '2em'
                }}>
                    <h2 style={{ marginTop: 0, marginBottom: '1em', color: '#00171F' }}>Cambiar Contraseña</h2>
                    <form onSubmit={handleUpdatePassword}>
                        <div style={{ position: 'relative', marginBottom: '1em' }}>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                style={{
                                    width: '100%',
                                    padding: '0.75em',
                                    paddingLeft: '2.5em',
                                    borderRadius: '5px',
                                    border: '2px solid #00171F',
                                    fontSize: '1em',
                                }}
                                placeholder="Nueva contraseña"
                            />
                            <i
                                className="fa-solid fa-key"
                                style={{ position: 'absolute', left: '0.8em', top: '50%', transform: 'translateY(-50%)', color: '#00171F' }}
                            ></i>
                        </div>
                        <div style={{ position: 'relative', marginBottom: '1em' }}>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                style={{
                                    width: '100%',
                                    padding: '0.75em',
                                    paddingLeft: '2.5em',
                                    borderRadius: '5px',
                                    border: '2px solid #00171F',
                                    fontSize: '1em',
                                }}
                                placeholder="Confirmar contraseña"
                            />
                            <i
                                className="fa-solid fa-key"
                                style={{ position: 'absolute', left: '0.8em', top: '50%', transform: 'translateY(-50%)', color: '#00171F' }}
                            ></i>
                        </div>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={updating}
                            style={{ width: '100%' }}
                        >
                            {updating ? 'Actualizando...' : 'Cambiar Contraseña'}
                        </button>
                    </form>
                </div>

                {/* Messages */}
                {error && (
                    <div style={{
                        color: '#FF0000',
                        backgroundColor: 'rgba(255, 0, 0, 0.1)',
                        padding: '1em',
                        borderRadius: '5px',
                        marginBottom: '1em',
                        fontWeight: 600,
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                {success && (
                    <div style={{
                        color: '#00FF00',
                        backgroundColor: 'rgba(0, 255, 0, 0.1)',
                        padding: '1em',
                        borderRadius: '5px',
                        marginBottom: '1em',
                        fontWeight: 600,
                        textAlign: 'center'
                    }}>
                        {success}
                    </div>
                )}

                {/* Logout Button */}
                <button
                    onClick={handleLogout}
                    className="btn-secondary"
                    style={{ width: '100%' }}
                >
                    Cerrar Sesión
                </button>
            </div>
        </div>
    )
}

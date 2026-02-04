'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'

export default function JUDIPage() {
    const [user, setUser] = useState<any>(null)
    const [games, setGames] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadUserAndGames()
    }, [])

    const loadUserAndGames = async () => {
        // Check auth
        const { data: { user: authUser } } = await supabase.auth.getUser()
        setUser(authUser)

        // Load JUDI games
        const { data: judiGames } = await supabase
            .from('hubgames_lista_videojuegos_judi')
            .select('*')
            .order('id', { ascending: false })

        if (judiGames) {
            // If user is logged in, load their progress
            if (authUser) {
                const gamesWithProgress = await Promise.all(
                    judiGames.map(async (game) => {
                        const { data: progress } = await supabase
                            .from('hubgames_judi_fases_usuario')
                            .select('*')
                            .eq('id_lista_judi', game.id)
                            .eq('id_usuario', authUser.id)
                            .single()

                        if (!progress) {
                            // Initialize progress for this game
                            await supabase.from('hubgames_judi_fases_usuario').insert({
                                id_lista_judi: game.id,
                                id_usuario: authUser.id,
                                completado: false,
                                fase1: false,
                                fase2: false,
                                fase3: false,
                                fase4: false,
                                fase5: false,
                                fase6: false,
                                fase7: false,
                            })

                            return { ...game, completado: false, fase6: false }
                        }

                        return { ...game, ...progress }
                    })
                )
                setGames(gamesWithProgress)
            } else {
                // Guest user - use localStorage
                const localProgress = localStorage.getItem('judi_progress')
                const progressData = localProgress ? JSON.parse(localProgress) : {}

                const gamesWithProgress = judiGames.map((game) => ({
                    ...game,
                    completado: progressData[game.id]?.completado || false,
                    fase6: progressData[game.id]?.fase6 || false,
                }))

                setGames(gamesWithProgress)
            }
        }

        setLoading(false)
    }

    const updateProgress = async (gameId: number, field: string, value: boolean) => {
        if (user) {
            // Update in database
            await supabase
                .from('hubgames_judi_fases_usuario')
                .update({ [field]: value })
                .eq('id_lista_judi', gameId)
                .eq('id_usuario', user.id)
        } else {
            // Update in localStorage
            const localProgress = localStorage.getItem('judi_progress')
            const progressData = localProgress ? JSON.parse(localProgress) : {}

            if (!progressData[gameId]) {
                progressData[gameId] = {}
            }
            progressData[gameId][field] = value

            localStorage.setItem('judi_progress', JSON.stringify(progressData))
        }

        // Reload games to reflect changes
        loadUserAndGames()
    }

    if (loading) {
        return (
            <div className="cuerpo">
                <div style={{ textAlign: 'center', color: '#00171F' }}>Cargando juegos JUDI...</div>
            </div>
        )
    }

    return (
        <div className="cuerpo">
            <h1 style={{ color: '#00171F', marginBottom: '1em' }}>JUDI - Juegos Únicos De Interés</h1>

            {!user && (
                <div
                    style={{
                        backgroundColor: 'rgba(255, 167, 4, 0.2)',
                        padding: '1em',
                        borderRadius: '5px',
                        marginBottom: '1.5em',
                        border: '2px solid rgb(255, 167, 4)',
                    }}
                >
                    <strong>Nota:</strong> No has iniciado sesión. Tu progreso se guardará localmente en este dispositivo.{' '}
                    <Link href="/login" style={{ color: '#00A8E8', fontWeight: 700 }}>
                        Inicia sesión
                    </Link>{' '}
                    para guardar tu progreso en la nube.
                </div>
            )}

            {games.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#00171F' }}>
                    No hay juegos JUDI disponibles aún.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5em' }}>
                    {games.map((game) => (
                        <div
                            key={game.id}
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                padding: '1.5em',
                                borderRadius: '5px',
                                border: game.completado ? '3px solid #00FF00' : '2px solid #00171F',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1em' }}>
                                <h3 style={{ color: '#00171F', margin: 0 }}>{game.nombre}</h3>
                                {game.completado && (
                                    <span
                                        style={{
                                            backgroundColor: '#00FF00',
                                            color: '#00171F',
                                            padding: '0.5em 1em',
                                            borderRadius: '5px',
                                            fontWeight: 700,
                                        }}
                                    >
                                        ✓ Completado
                                    </span>
                                )}
                            </div>

                            <div style={{ marginBottom: '1em', color: '#00171F' }}>
                                <div><strong>Desarrollador:</strong> {game.desarrollador}</div>
                                <div><strong>Lanzamiento:</strong> {game.released}</div>
                                <div><strong>Calificación:</strong> {game.calificacion}/100</div>
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5em' }}>
                                {[1, 2, 3, 4, 5, 6, 7].map((fase) => (
                                    <button
                                        key={fase}
                                        onClick={() => updateProgress(game.id, `fase${fase}`, !(game as any)[`fase${fase}`])}
                                        style={{
                                            padding: '0.5em 1em',
                                            borderRadius: '5px',
                                            border: 'none',
                                            backgroundColor: (game as any)[`fase${fase}`] ? '#00A8E8' : '#CCC',
                                            color: (game as any)[`fase${fase}`] ? '#FFF' : '#00171F',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Fase {fase}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

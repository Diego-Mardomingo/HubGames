'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import Loader from '@/components/Loader'
import { searchGames } from '@/lib/rawg'
import './judi.css'

type GameRecord = {
    id: number
    id_videojuego: number
    nombre: string
    fecha: string
    calificacion: number
    desarrollador: string
    released: string
    completado?: boolean
    fase1?: boolean
    fase2?: boolean
    fase3?: boolean
    fase4?: boolean
    fase5?: boolean
    fase6?: boolean
}

type GameData = {
    juego: GameRecord
    capturas: string[]
    plataformas: string[]
    generos: string[]
}

export default function JUDIPage() {
    const [user, setUser] = useState<any>(null)
    const [games, setGames] = useState<GameRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState<'list' | 'game'>('list')
    const [selectedGame, setSelectedGame] = useState<GameData | null>(null)
    const [leaderboard, setLeaderboard] = useState<any[]>([])

    // Game State
    const [highestUnlockedPhase, setHighestUnlockedPhase] = useState(1)
    const [activeViewedPhase, setActiveViewedPhase] = useState(1)
    const [lives, setLives] = useState(6)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [showResults, setShowResults] = useState(false)
    const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing')
    const [guessFeedback, setGuessFeedback] = useState<'correct' | 'wrong' | null>(null)

    const searchTimeout = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        loadUserAndGames()
    }, [])

    const loadUserAndGames = async () => {
        setLoading(true)
        const { data: { user: authUser } } = await supabase.auth.getUser()
        setUser(authUser)

        const { data: judiGames } = await supabase
            .from('hubgames_lista_videojuegos_judi')
            .select('*')
            .order('id', { ascending: false })

        if (judiGames) {
            let userProgress: any[] = []
            if (authUser) {
                const { data: progress } = await supabase
                    .from('hubgames_judi_fases_usuario')
                    .select('*')
                    .eq('id_usuario', authUser.id)
                userProgress = progress || []
            } else {
                const localProgress = localStorage.getItem('judi_progress')
                userProgress = localProgress ? Object.values(JSON.parse(localProgress)) : []
            }

            const gamesWithProgress = judiGames.map(game => {
                const progress = userProgress.find((p: any) => p.id_lista_judi === game.id)
                return {
                    ...game,
                    completado: progress?.completado || false,
                    fase6: progress?.fase6 || false
                }
            })
            setGames(gamesWithProgress)
        }

        // Load leaderboard
        await loadLeaderboard()

        setLoading(false)
    }

    const loadLeaderboard = async () => {
        const { data: leaderboardData } = await supabase
            .from('hubgames_judi_fases_usuario')
            .select('id_usuario, completado')
            .eq('completado', true)

        if (leaderboardData) {
            // Count completions per user
            const userCounts: { [key: string]: number } = {}
            leaderboardData.forEach((record: any) => {
                userCounts[record.id_usuario] = (userCounts[record.id_usuario] || 0) + 1
            })

            // Get user details - simplified for client-side (no admin access)
            const userIds = Object.keys(userCounts)

            const leaderboardWithNames = userIds.map((userId, index) => {
                const gamingNames = ['Maestro', 'Experto', 'Leyenda', 'Pro', 'As', 'Crack', 'Genio', 'Mago']
                const username = `${gamingNames[index % gamingNames.length]} #${userId.slice(0, 4)}`
                return {
                    userId,
                    username,
                    completions: userCounts[userId]
                }
            })

            // Sort by completions and take top 5
            const topUsers = leaderboardWithNames
                .sort((a, b) => b.completions - a.completions)
                .slice(0, 5)

            setLeaderboard(topUsers)
        }
    }

    const startJuego = async (game: GameRecord) => {
        setLoading(true)

        // Reset search, feedback and results state
        setSearchQuery('')
        setSearchResults([])
        setShowResults(false)
        setGuessFeedback(null)

        const [capturasRes, platformsRes, genresRes] = await Promise.all([
            supabase.from('hubgames_capturas').select('captura').eq('id_videojuego', game.id_videojuego),
            supabase.from('hubgames_videojuego_plataforma').select('plataforma').eq('id_videojuego', game.id_videojuego),
            supabase.from('hubgames_videojuego_genero').select('genero').eq('id_videojuego', game.id_videojuego)
        ])

        const gameData: GameData = {
            juego: game,
            capturas: (capturasRes.data || []).map(c => c.captura),
            plataformas: (platformsRes.data || []).map(p => p.plataforma),
            generos: (genresRes.data || []).map(g => g.genero)
        }

        let progress: any = null
        const { data: { user: authUser } } = await supabase.auth.getUser() // Always refetch user
        if (authUser) {
            const { data } = await supabase
                .from('hubgames_judi_fases_usuario')
                .select('*')
                .eq('id_lista_judi', game.id)
                .eq('id_usuario', authUser.id)
                .maybeSingle() // Fix 406 Error
            progress = data
        } else {
            const localProgress = localStorage.getItem('judi_progress')
            const progressData = localProgress ? JSON.parse(localProgress) : {}
            progress = progressData[game.id]
        }

        if (progress?.completado) {
            setGameState('won')
            setHighestUnlockedPhase(6)
            setActiveViewedPhase(6)
            setLives(6)
        } else if (progress?.fase6) {
            setGameState('lost')
            setHighestUnlockedPhase(6)
            setActiveViewedPhase(6)
            setLives(0)
        } else {
            let phase = 1
            if (progress?.fase5) phase = 6
            else if (progress?.fase4) phase = 5
            else if (progress?.fase3) phase = 4
            else if (progress?.fase2) phase = 3
            else if (progress?.fase1) phase = 2

            setHighestUnlockedPhase(phase)
            setActiveViewedPhase(phase)
            setLives(7 - phase)
            setGameState('playing')
        }

        setSelectedGame(gameData)
        setView('game')
        setLoading(false)
    }

    const handleNavigate = (direction: 'prev' | 'next') => {
        if (!selectedGame || games.length === 0) return

        const currentIndex = games.findIndex(g => g.id === selectedGame.juego.id)
        if (currentIndex === -1) return

        let newIndex = -1
        if (direction === 'next' && currentIndex > 0) {
            newIndex = currentIndex - 1 // Array is ordered descending (newest first), so 'next' (newer) is lower index
        } else if (direction === 'prev' && currentIndex < games.length - 1) {
            newIndex = currentIndex + 1 // 'prev' (older) is higher index
        }

        if (newIndex !== -1) {
            startJuego(games[newIndex])
        }
    }

    const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value
        setSearchQuery(query)

        if (searchTimeout.current) clearTimeout(searchTimeout.current)

        if (query.length > 2) {
            searchTimeout.current = setTimeout(async () => {
                try {
                    const data = await searchGames({
                        search: query,
                        page_size: 10
                    })
                    setSearchResults(data.results || [])
                    setShowResults(true)
                } catch (err) {
                    console.error("RAWG Search Error:", err)
                    setSearchResults([])
                }
            }, 400)
        } else {
            setSearchResults([])
            setShowResults(false)
        }
    }

    // Clear feedback after delay
    useEffect(() => {
        if (guessFeedback) {
            const timer = setTimeout(() => {
                setGuessFeedback(null)
            }, 3000)
            return () => clearTimeout(timer)
        }
    }, [guessFeedback])

    const handleAdivinar = async () => {
        if (!selectedGame || gameState !== 'playing') return

        const isCorrect = searchQuery.trim().toLowerCase() === selectedGame.juego.nombre.toLowerCase()

        // Clear search results immediately
        setSearchResults([])
        setShowResults(false)

        if (isCorrect) {
            setGuessFeedback('correct')
            setGameState('won')
            await updateProgress(selectedGame.juego.id, 'completado', true)
        } else {
            const nextPhase = highestUnlockedPhase + 1
            if (nextPhase > 6) {
                setHighestUnlockedPhase(6)
                setLives(0)
                setGameState('lost')
                await updateProgress(selectedGame.juego.id, 'fase6', true)
            } else {
                setGuessFeedback('wrong')
                const currentPhaseToMark = highestUnlockedPhase
                setHighestUnlockedPhase(nextPhase)
                setActiveViewedPhase(nextPhase)
                setLives(7 - nextPhase)
                await updateProgress(selectedGame.juego.id, `fase${currentPhaseToMark}`, true)
            }
        }

        setSearchQuery('')
    }

    const updateProgress = async (gameId: number, field: string, value: any) => {
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (authUser) {
            const { data: existing } = await supabase
                .from('hubgames_judi_fases_usuario')
                .select('id_lista_judi')
                .eq('id_lista_judi', gameId)
                .eq('id_usuario', authUser.id)
                .maybeSingle() // Fix 406 Error here too

            if (existing) {
                const { error } = await supabase
                    .from('hubgames_judi_fases_usuario')
                    .update({ [field]: value })
                    .eq('id_lista_judi', gameId)
                    .eq('id_usuario', authUser.id)

                if (error) console.error("Supabase Update Error:", error)
            } else {
                const { error } = await supabase
                    .from('hubgames_judi_fases_usuario')
                    .insert({
                        id_lista_judi: gameId,
                        id_usuario: authUser.id,
                        [field]: value
                    })

                if (error) console.error("Supabase Insert Error:", error)
            }
        } else {
            const localProgress = localStorage.getItem('judi_progress')
            const progressData = localProgress ? JSON.parse(localProgress) : {}

            if (!progressData[gameId]) {
                progressData[gameId] = { id_lista_judi: gameId }
            }
            progressData[gameId][field] = value

            localStorage.setItem('judi_progress', JSON.stringify(progressData))
        }
    }

    const renderHearts = () => {
        return (
            <div className="hearts-container">
                {[...Array(6)].map((_, i) => (
                    <span key={i} className={`heart-icon ${i < lives ? 'heart-full' : 'heart-empty'}`}>
                        {i < lives ? '❤️' : '🤍'}
                    </span>
                ))}
            </div>
        )
    }

    if (loading && !selectedGame) {
        return (
            <div className="judi-container"><div className="cuerpo"><Loader /></div></div>
        )
    }

    return (
        <div className="judi-container">
            {guessFeedback && (
                <div className={`feedback-toast ${guessFeedback === 'correct' ? 'feedback-correct' : 'feedback-wrong'}`}>
                    {guessFeedback === 'correct' ? (
                        <><i className="fa-solid fa-circle-check"></i> ¡Increíble! Es correcto</>
                    ) : (
                        <><i className="fa-solid fa-circle-xmark"></i> Casi... ¡Prueba de nuevo!</>
                    )}
                </div>
            )}

            <div className="cuerpo" style={{
                backgroundColor: 'transparent',
                backdropFilter: 'none',
                border: 'none',
                boxShadow: 'none',
                maxWidth: '1200px',
                width: '100%',
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}>
                {view === 'list' ? (
                    <div className="judi_list_view" style={{ width: '100%' }}>
                        <div className="titulo">
                            <h1>JUDI</h1>
                            <h3>(Juego del día)</h3>
                        </div>

                        {!user && (
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <div className="sesion-msg">
                                    <i className="fa-solid fa-circle-info"></i> Recomendamos <Link href="/login" style={{ color: '#00A8E8', fontWeight: 700 }}>iniciar sesión</Link> para guardar tu progreso
                                </div>
                            </div>
                        )}

                        {/* Leaderboard */}
                        {leaderboard.length > 0 && (
                            <div className="leaderboard-container">
                                <h2 className="leaderboard-title">
                                    <i className="fa-solid fa-trophy" style={{ marginRight: '0.5em', color: '#FFD700' }}></i>
                                    Top Jugadores
                                </h2>
                                <div className="leaderboard-list">
                                    {leaderboard.map((player, index) => {
                                        const maxCompletions = leaderboard[0].completions
                                        const percentage = (player.completions / maxCompletions) * 100
                                        const medals = ['🥇', '🥈', '🥉']

                                        return (
                                            <div key={player.userId} className={`leaderboard-item ${index === 0 ? 'top-1' : ''}`}>
                                                <div className="leaderboard-rank">
                                                    {medals[index] || `#${index + 1}`}
                                                </div>
                                                <div className="leaderboard-info">
                                                    <div className="leaderboard-name">
                                                        {player.username}
                                                    </div>
                                                    <div className="leaderboard-bar-bg">
                                                        <div
                                                            className="leaderboard-bar-fill"
                                                            style={{ width: `${percentage}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                                <div className="leaderboard-score">
                                                    {player.completions}
                                                    <span>pts</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="grid-container">
                            {games.map((game) => (
                                <div key={game.id} className="juego-card">
                                    <div className="card-header">
                                        <span className="card-id">#{game.id}</span>
                                        <span className="card-date">{game.fecha}</span>
                                    </div>
                                    <div className="card-body">
                                        {game.completado ? (
                                            <div className="card-status status-won">
                                                <i className="fa-solid fa-trophy" style={{ marginRight: '8px' }}></i> COMPLETADO
                                            </div>
                                        ) : game.fase6 ? (
                                            <div className="card-status status-lost">
                                                <i className="fa-solid fa-skull" style={{ marginRight: '8px' }}></i> FALLADO
                                            </div>
                                        ) : (
                                            <div className="btn-primary"
                                                style={{ width: '100%', textAlign: 'center', fontSize: '0.8rem', padding: '0.8rem' }}
                                                onClick={() => startJuego(game)}>
                                                ¡JUGAR!
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    selectedGame && (
                        <div className="judi_game_view" style={{ width: '100%', maxWidth: '1000px' }}>
                            <div className="cabecera" style={{ marginBottom: '2em' }}>
                                <button className="btn-secondary" style={{ padding: '0.8rem 1.5rem', fontSize: '0.95rem', fontWeight: 600 }} onClick={() => { setView('list'); loadUserAndGames(); }}>
                                    ← Volver al listado
                                </button>

                                {gameState !== 'playing' && (
                                    <div className="game-nav-controls">
                                        <button
                                            className="boton_pag_mini"
                                            style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '50%', width: '3em', height: '3em' }}
                                            onClick={() => handleNavigate('prev')}
                                            disabled={games.findIndex(g => g.id === selectedGame.juego.id) >= games.length - 1}
                                        >
                                            <i className="fa-solid fa-chevron-left"></i>
                                        </button>

                                        <div className="fecha-banner" style={{ fontSize: '1.1rem', fontWeight: 700, padding: '0.8em 1.5em' }}>
                                            #{selectedGame.juego.id} — {selectedGame.juego.fecha}
                                        </div>

                                        <button
                                            className="boton_pag_mini"
                                            style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '50%', width: '3em', height: '3em' }}
                                            onClick={() => handleNavigate('next')}
                                            disabled={games.findIndex(g => g.id === selectedGame.juego.id) <= 0}
                                        >
                                            <i className="fa-solid fa-chevron-right"></i>
                                        </button>
                                    </div>
                                )}

                                {gameState === 'playing' && (
                                    <div className="fecha-banner" style={{ fontSize: '1.2rem', fontWeight: 700, padding: '1em 2em', margin: '0 auto' }}>
                                        #{selectedGame.juego.id} — {selectedGame.juego.fecha}
                                    </div>
                                )}
                            </div>

                            <div className="fases">
                                {[1, 2, 3, 4, 5, 6].map(f => (
                                    <div
                                        key={f}
                                        className={`fase ${f === activeViewedPhase ? 'active' : ''} ${f > highestUnlockedPhase && gameState === 'playing' ? 'locked' : ''}`}
                                        onClick={() => (f <= highestUnlockedPhase || gameState !== 'playing') && setActiveViewedPhase(f)}
                                    >
                                        {f <= highestUnlockedPhase || gameState !== 'playing' ? f : <i className="fa-solid fa-lock" style={{ fontSize: '0.7em' }}></i>}
                                    </div>
                                ))}
                            </div>

                            <div className="game-data-box glass-panel">
                                {selectedGame.capturas.length > 0 && (
                                    <img
                                        src={selectedGame.capturas[activeViewedPhase === 1 ? 5 : activeViewedPhase - 2] || selectedGame.capturas[0]}
                                        alt="Pista del juego"
                                        className="game-image"
                                        style={{ objectFit: 'cover' }}
                                    />
                                )}
                                {activeViewedPhase > 1 && (
                                    <div className="pista-overlay">
                                        {activeViewedPhase === 2 && (
                                            <><i className="fa-solid fa-fire-pulse" style={{ color: '#00A8E8', marginRight: '10px' }}></i> Popularidad: <strong>{selectedGame.juego.desarrollador} / 5</strong></>
                                        )}
                                        {activeViewedPhase === 3 && (
                                            <><i className="fa-solid fa-star" style={{ color: '#00A8E8', marginRight: '10px' }}></i> Metacritic: <strong>{selectedGame.juego.calificacion} / 100</strong></>
                                        )}
                                        {activeViewedPhase === 4 && (
                                            <><i className="fa-solid fa-display" style={{ color: '#00A8E8', marginRight: '10px' }}></i> {selectedGame.plataformas.join(', ')}</>
                                        )}
                                        {activeViewedPhase === 5 && (
                                            <><i className="fa-solid fa-tags" style={{ color: '#00A8E8', marginRight: '10px' }}></i> {selectedGame.generos.join(', ')}</>
                                        )}
                                        {activeViewedPhase === 6 && (
                                            <><i className="fa-solid fa-calendar-days" style={{ color: '#00A8E8', marginRight: '10px' }}></i> Lanzamiento: <strong>{selectedGame.juego.released}</strong></>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5em' }}>
                                <div className="hearts-container">
                                    {[...Array(6)].map((_, i) => (
                                        <i key={i} className={`fa-solid fa-heart heart-icon ${i < lives ? '' : 'heart-empty'}`}
                                            style={{ color: i < lives ? '#ff4757' : 'rgba(255,255,255,0.2)' }}></i>
                                    ))}
                                </div>

                                {gameState === 'playing' ? (
                                    <div className="guess-area">
                                        <div className="input-group">
                                            <input
                                                className="buscador-input"
                                                placeholder="¿Qué juego es?..."
                                                value={searchQuery}
                                                onChange={handleSearchInput}
                                                onFocus={() => setShowResults(true)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAdivinar()}
                                            />
                                            {showResults && searchResults.length > 0 && (
                                                <div className="autocomplete-dropdown glass-panel">
                                                    {searchResults.map((res: any) => (
                                                        <div
                                                            key={res.id}
                                                            className="autocomplete-item"
                                                            onClick={() => {
                                                                setSearchQuery(res.name)
                                                                setShowResults(false)
                                                            }}
                                                        >
                                                            {res.name}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="btn-primary" style={{ width: '200px', borderRadius: '50px', display: 'flex', justifyContent: 'center' }} onClick={handleAdivinar}>
                                            ADIVINAR
                                        </div>
                                    </div>
                                ) : (
                                    <div className={`resultado-final glass-panel ${gameState === 'won' ? 'victory' : 'defeat'}`}
                                        style={{
                                            background: gameState === 'won' ? 'rgba(46, 213, 115, 0.1)' : 'rgba(255, 71, 87, 0.1)',
                                            borderColor: gameState === 'won' ? '#2ed573' : '#ff4757',
                                            maxWidth: '600px',
                                            margin: '0 auto'
                                        }}>
                                        <h2 style={{ color: gameState === 'won' ? '#2ed573' : '#ff4757' }}>
                                            {gameState === 'won' ? '¡VICTORIA!' : 'DERROTA'}
                                        </h2>
                                        <p style={{ fontSize: '1.2rem', marginBottom: '1.5em' }}>
                                            {gameState === 'won' ? '¡Has identificado el juego correctamente!' : 'No has podido identificar el juego esta vez.'}
                                            <br />
                                            El juego era: <strong style={{ color: '#fff' }}>{selectedGame.juego.nombre}</strong>
                                        </p>
                                        <button className="btn-primary" onClick={() => { setView('list'); loadUserAndGames(); }}>
                                            Volver al listado
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
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
        setLoading(false)
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
        if (user) {
            const { data } = await supabase
                .from('hubgames_judi_fases_usuario')
                .select('*')
                .eq('id_lista_judi', game.id)
                .eq('id_usuario', user.id)
                .single()
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

    const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value
        setSearchQuery(query)

        if (searchTimeout.current) clearTimeout(searchTimeout.current)

        if (query.length > 2) {
            searchTimeout.current = setTimeout(async () => {
                try {
                    const res = await fetch(`https://api.rawg.io/api/games?key=3b597a76023d49faa0deba195b7b78b7&search=${encodeURIComponent(query)}&page_size=10&exclude_additions=true`)
                    const data = await res.json()
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

    const handleAdivinar = async () => {
        if (!selectedGame || gameState !== 'playing' || !searchQuery.trim()) return

        const isCorrect = searchQuery.trim().toLowerCase() === selectedGame.juego.nombre.toLowerCase()

        // Clear search results immediately
        setSearchResults([])
        setShowResults(false)

        if (isCorrect) {
            setGuessFeedback('correct')
            // Important: update local state before wait
            setGameState('won')
            await updateProgress(selectedGame.juego.id, 'completado', true)
        } else {
            const nextPhase = highestUnlockedPhase + 1
            if (nextPhase > 6) {
                // Definitive loss: No feedback toast per user request
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

        if (guessFeedback !== null) {
            setTimeout(() => setGuessFeedback(null), 2500)
        }
        setSearchQuery('')
    }

    const updateProgress = async (gameId: number, field: string, value: any) => {
        if (user) {
            const { error } = await supabase
                .from('hubgames_judi_fases_usuario')
                .upsert({
                    id_lista_judi: gameId,
                    id_usuario: user.id,
                    [field]: value
                }, { onConflict: 'id_lista_judi,id_usuario' })

            if (error) console.error("Update Progress Error:", error)
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
                        ❤️
                    </span>
                ))}
            </div>
        )
    }

    if (loading && !selectedGame) {
        return (
            <div className="judi-container"><div className="cuerpo"><h1>Cargando...</h1></div></div>
        )
    }

    return (
        <div className="judi-container">
            {guessFeedback && (
                <div className={`feedback-toast ${guessFeedback === 'correct' ? 'feedback-correct' : 'feedback-wrong'}`}>
                    {guessFeedback === 'correct' ? '¡Correcto!' : '¡Incorrecto! Prueba de nuevo'}
                </div>
            )}

            <div className="cuerpo">
                {view === 'list' ? (
                    <>
                        <div className="titulo">
                            <h1>JUDI</h1>
                            <h3>(Juego del día)</h3>
                        </div>
                        {!user && (
                            <div className="sesion-msg">
                                Recomendamos <Link href="/login" style={{ color: '#00A8E8', fontWeight: 700 }}>iniciar sesión</Link> para guardar tu progreso
                            </div>
                        )}
                        <div className="grid-container">
                            {games.map((game, idx) => (
                                <div key={game.id} className="juego-card">
                                    <div className="card-header">
                                        <span className="card-id">#{game.id}</span>
                                        <span className="card-date">{game.fecha}</span>
                                    </div>
                                    {game.completado ? (
                                        <div className="card-status status-won">✓</div>
                                    ) : game.fase6 ? (
                                        <div className="card-status status-lost">✗</div>
                                    ) : (
                                        <div className="card-status btn-jugar" onClick={() => startJuego(game)}>
                                            ¡Jugar!
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    selectedGame && (
                        <>
                            <div className="cabecera">
                                <div className="boton-volver" onClick={() => { setView('list'); loadUserAndGames(); }}>
                                    ← Volver al listado
                                </div>
                                <div className="fecha-banner">
                                    {selectedGame.juego.fecha} (#{selectedGame.juego.id})
                                </div>
                            </div>

                            <div className="fases">
                                {[1, 2, 3, 4, 5, 6].map(f => (
                                    <div
                                        key={f}
                                        className={`fase ${f === activeViewedPhase ? 'active' : ''} ${f > highestUnlockedPhase && gameState === 'playing' ? 'locked' : ''}`}
                                        onClick={() => (f <= highestUnlockedPhase || gameState !== 'playing') && setActiveViewedPhase(f)}
                                    >
                                        {f}
                                    </div>
                                ))}
                            </div>

                            <div className="game-data-box">
                                {selectedGame.capturas.length > 0 && (
                                    <img
                                        src={selectedGame.capturas[activeViewedPhase === 1 ? 5 : activeViewedPhase - 2] || selectedGame.capturas[0]}
                                        alt="Pista"
                                        className="game-image"
                                    />
                                )}
                                {activeViewedPhase > 1 && (
                                    <div className="pista-overlay">
                                        {activeViewedPhase === 2 && `Popularidad: ${selectedGame.juego.desarrollador}/5`}
                                        {activeViewedPhase === 3 && `Metacritic: ${selectedGame.juego.calificacion}/100`}
                                        {activeViewedPhase === 4 && `Plataformas: ${selectedGame.plataformas.join(', ')}`}
                                        {activeViewedPhase === 5 && `Géneros: ${selectedGame.generos.join(', ')}`}
                                        {activeViewedPhase === 6 && `Lanzamiento: ${selectedGame.juego.released}`}
                                    </div>
                                )}
                            </div>

                            {renderHearts()}

                            {gameState === 'playing' ? (
                                <div className="guess-area">
                                    <div className="input-group">
                                        <input
                                            className="buscador-input"
                                            placeholder="¿Qué juego es?"
                                            value={searchQuery}
                                            onChange={handleSearchInput}
                                            onFocus={() => setShowResults(true)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAdivinar()}
                                        />
                                        {showResults && searchResults.length > 0 && (
                                            <div className="autocomplete-dropdown">
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
                                    <div className="card-status btn-jugar" style={{ width: '200px', cursor: 'pointer', borderRadius: '50px' }} onClick={handleAdivinar}>
                                        ADIVINAR
                                    </div>
                                </div>
                            ) : (
                                <div className={`resultado-final ${gameState === 'won' ? 'victory' : 'defeat'}`}>
                                    <h2>{gameState === 'won' ? '¡Increíble!' : '¡Mala suerte!'}</h2>
                                    <p>El juego era: <strong>{selectedGame.juego.nombre}</strong></p>
                                    <button className="boton-volver" style={{ margin: '1rem auto' }} onClick={() => { setView('list'); loadUserAndGames(); }}>
                                        Volver al listado
                                    </button>
                                </div>
                            )}
                        </>
                    )
                )}
            </div>
        </div>
    )
}

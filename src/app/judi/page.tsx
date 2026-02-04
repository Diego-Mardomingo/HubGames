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
    const [currentPhase, setCurrentPhase] = useState(1)
    const [lives, setLives] = useState(6)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [showResults, setShowResults] = useState(false)
    const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing')
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
                    fase6: progress?.fase6 || false // Used to detect if game was lost (all phases failed)
                }
            })
            setGames(gamesWithProgress)
        }
        setLoading(false)
    }

    const startJuego = async (game: GameRecord) => {
        setLoading(true)

        // Fetch detailed game data
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

        // Determine current phase/lives based on progress
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
        } else if (progress?.fase6) {
            setGameState('lost')
        } else {
            // Count completed phases to set current state
            let phase = 1
            if (progress?.fase5) phase = 6
            else if (progress?.fase4) phase = 5
            else if (progress?.fase3) phase = 4
            else if (progress?.fase2) phase = 3
            else if (progress?.fase1) phase = 2

            setCurrentPhase(phase)
            setLives(7 - phase)
            setGameState('playing')
        }

        setSelectedGame(gameData)
        setSearchQuery('')
        setView('game')
        setLoading(false)
    }

    const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value
        setSearchQuery(query)

        if (searchTimeout.current) clearTimeout(searchTimeout.current)

        if (query.length > 2) {
            searchTimeout.current = setTimeout(async () => {
                const hoy = new Date().toISOString().split('T')[0]
                const menos10años = new Date()
                menos10años.setFullYear(menos10años.getFullYear() - 10)
                const startDate = menos10años.toISOString().split('T')[0]

                const res = await fetch(`https://api.rawg.io/api/games?key=3b597a76023d49faa0deba195b7b78b7&exclude_additions=true&dates=${startDate},${hoy}&search=${encodeURIComponent(query)}`)
                const data = await res.json()
                setSearchResults(data.results || [])
                setShowResults(true)
            }, 500)
        } else {
            setSearchResults([])
            setShowResults(false)
        }
    }

    const handleAdivinar = async () => {
        if (!selectedGame || gameState !== 'playing') return

        const isCorrect = searchQuery.trim().toLowerCase() === selectedGame.juego.nombre.toLowerCase()

        if (isCorrect) {
            await updateProgress(selectedGame.juego.id, 'completado', true)
            setGameState('won')
        } else {
            const nextPhase = currentPhase + 1
            if (nextPhase > 6) {
                await updateProgress(selectedGame.juego.id, 'fase6', true)
                setGameState('lost')
            } else {
                await updateProgress(selectedGame.juego.id, `fase${currentPhase}`, true)
                setCurrentPhase(nextPhase)
                setLives(7 - nextPhase)
            }
        }
        setSearchQuery('')
        setShowResults(false)
    }

    const updateProgress = async (gameId: number, field: string, value: boolean) => {
        if (user) {
            // Ensure record exists
            const { data: existing } = await supabase
                .from('hubgames_judi_fases_usuario')
                .select('id')
                .eq('id_lista_judi', gameId)
                .eq('id_usuario', user.id)
                .single()

            if (existing) {
                await supabase
                    .from('hubgames_judi_fases_usuario')
                    .update({ [field]: value })
                    .eq('id_lista_judi', gameId)
                    .eq('id_usuario', user.id)
            } else {
                await supabase.from('hubgames_judi_fases_usuario').insert({
                    id_lista_judi: gameId,
                    id_usuario: user.id,
                    [field]: value
                })
            }
        } else {
            const localProgress = localStorage.getItem('judi_progress')
            const progressData = localProgress ? JSON.parse(localProgress) : {}
            if (!progressData[gameId]) progressData[gameId] = { id_lista_judi: gameId }
            progressData[gameId][field] = value
            localStorage.setItem('judi_progress', JSON.stringify(progressData))
        }
    }

    const renderHeart = (full: boolean, index: number) => (
        <span key={index} className={full ? 'heart-full' : 'heart-empty'}>
            {full ? '❤️' : '🤍'}
        </span>
    )

    if (loading && !selectedGame) {
        return (
            <div className="judi-container">
                <div className="cuerpo">
                    <div className="titulo"><h1>Cargando...</h1></div>
                </div>
            </div>
        )
    }

    return (
        <div className="judi-container">
            <div className="cuerpo">
                {view === 'list' ? (
                    <>
                        <div className="titulo">
                            <h1>JUDI</h1>
                            <h3>(Juego del día)</h3>
                        </div>
                        {!user && (
                            <div className="sesion-msg">
                                Recomendamos <Link href="/login">iniciar sesión</Link> para poder guardar tu progreso
                            </div>
                        )}
                        <div className="lista">
                            {games.map((game, idx) => (
                                <div key={game.id} className="juego-row">
                                    <div className="id-lista"># {games.length - idx}</div>
                                    <div className="fecha-col">{game.fecha}</div>
                                    {game.completado ? (
                                        <div className="fondo-verde">✓</div>
                                    ) : game.fase6 ? (
                                        <div className="fondo-rojo">✗</div>
                                    ) : (
                                        <div className="boton-jugar" onClick={() => startJuego(game)}>
                                            ¡Jugar! <span>➜</span>
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
                                    ← Volver
                                </div>
                                <div className="fecha-banner">
                                    Juego del día: {selectedGame.juego.fecha} #{selectedGame.juego.id}
                                </div>
                            </div>

                            <div className="contenido">
                                <div className="fases">
                                    {[1, 2, 3, 4, 5, 6].map(f => (
                                        <div
                                            key={f}
                                            className={`fase ${f === currentPhase ? 'seleccionado' : ''}`}
                                            onClick={() => f <= currentPhase && setCurrentPhase(f)}
                                            style={{ opacity: f <= (gameState !== 'playing' ? 6 : (6 - lives + 1)) ? 1 : 0.4 }}
                                        >
                                            {f}
                                        </div>
                                    ))}
                                </div>

                                <div className="game-data-box">
                                    {selectedGame.capturas.length > 0 && (
                                        <img
                                            src={selectedGame.capturas[currentPhase === 1 ? 5 : currentPhase - 2] || selectedGame.capturas[0]}
                                            alt="Capture"
                                            className="game-image"
                                        />
                                    )}
                                    <div className="pista-overlay">
                                        {currentPhase === 1 && "Pista 1: Primera imagen"}
                                        {currentPhase === 2 && `Popularidad: ${selectedGame.juego.desarrollador}/5`}
                                        {currentPhase === 3 && `Metacritic: ${selectedGame.juego.calificacion}/100`}
                                        {currentPhase === 4 && `Plataformas: ${selectedGame.plataformas.join(', ')}`}
                                        {currentPhase === 5 && `Géneros: ${selectedGame.generos.join(', ')}`}
                                        {currentPhase === 6 && `Lanzamiento: ${selectedGame.juego.released}`}
                                    </div>
                                </div>

                                <div className="vidas-container">
                                    {[...Array(6)].map((_, i) => renderHeart(i < lives, i))}
                                </div>

                                {gameState === 'playing' ? (
                                    <>
                                        <div className="buscador-container">
                                            <input
                                                className="buscador-input"
                                                placeholder="Nombre del juego..."
                                                value={searchQuery}
                                                onChange={handleSearchInput}
                                                onFocus={() => setShowResults(true)}
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
                                        <div className="boton-adivinar" onClick={handleAdivinar}>
                                            ADIVINAR
                                        </div>
                                    </>
                                ) : (
                                    <div className={`resultado-banner ${gameState === 'won' ? 'acertado' : 'fallado'}`}>
                                        {gameState === 'won'
                                            ? `¡Enhorabuena! El juego era ${selectedGame.juego.nombre}`
                                            : `¡Fallaste! El juego era ${selectedGame.juego.nombre}`
                                        }
                                    </div>
                                )}
                            </div>
                        </>
                    )
                )}
            </div>
            <footer style={{ marginTop: 'auto', padding: '2em', textAlign: 'center' }}>
                <div style={{ backgroundColor: 'rgba(240, 240, 240, 0.8)', display: 'inline-block', padding: '0.5em 1em', borderRadius: '5px', fontSize: '0.8em', fontWeight: 600 }}>
                    HUBGAMES © 2026
                </div>
            </footer>
        </div>
    )
}

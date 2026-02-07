'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
    const router = useRouter()
    const [view, setView] = useState<'start' | 'game'>('start')
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
    const [isImageExpanded, setIsImageExpanded] = useState(false)
    const [wrongGuesses, setWrongGuesses] = useState<string[]>([])

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
        setSearchQuery('')
        setSearchResults([])
        setShowResults(false)
        setGuessFeedback(null)
        setWrongGuesses([])
        setIsImageExpanded(false)

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
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
            const { data } = await supabase
                .from('hubgames_judi_fases_usuario')
                .select('*')
                .eq('id_lista_judi', game.id)
                .eq('id_usuario', authUser.id)
                .maybeSingle()
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
                    const data = await searchGames({ search: query, page_size: 10 })
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

    useEffect(() => {
        if (guessFeedback) {
            const timer = setTimeout(() => setGuessFeedback(null), 3000)
            return () => clearTimeout(timer)
        }
    }, [guessFeedback])

    const handleAdivinar = async () => {
        if (!selectedGame || gameState !== 'playing') return
        const isCorrect = searchQuery.trim().toLowerCase() === selectedGame.juego.nombre.toLowerCase()
        setSearchResults([])
        setShowResults(false)
        if (isCorrect) {
            setGuessFeedback('correct')
            setGameState('won')
            await updateProgress(selectedGame.juego.id, 'completado', true)
        } else {
            const nextPhase = highestUnlockedPhase + 1
            if (nextPhase > 6) {
                setWrongGuesses(prev => [...prev, searchQuery.trim()])
                setHighestUnlockedPhase(6)
                setLives(0)
                setGameState('lost')
                await updateProgress(selectedGame.juego.id, 'fase6', true)
            } else {
                setGuessFeedback('wrong')
                setWrongGuesses(prev => [...prev, searchQuery.trim()])
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
                .maybeSingle()
            if (existing) {
                await supabase.from('hubgames_judi_fases_usuario')
                    .update({ [field]: value })
                    .eq('id_lista_judi', gameId)
                    .eq('id_usuario', authUser.id)
            } else {
                await supabase.from('hubgames_judi_fases_usuario')
                    .insert({ id_lista_judi: gameId, id_usuario: authUser.id, [field]: value })
            }
        } else {
            const localProgress = localStorage.getItem('judi_progress')
            const progressData = localProgress ? JSON.parse(localProgress) : {}
            if (!progressData[gameId]) progressData[gameId] = { id_lista_judi: gameId }
            progressData[gameId][field] = value
            localStorage.setItem('judi_progress', JSON.stringify(progressData))
        }
    }

    if (loading && !selectedGame) {
        return <div className="judi-container"><div className="cuerpo"><Loader /></div></div>
    }

    return (
        <div className={`judi-container ${view === 'game' ? 'game-mode' : ''}`}>
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
                {view === 'start' ? (
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

                        <div className="grid-container">
                            {games.map((game) => (
                                <div key={game.id} className="juego-card">
                                    <div className="card-header">
                                        <span className="card-id">#{game.id}</span>
                                        <span className="card-date">{game.fecha}</span>
                                    </div>
                                    <div className="card-body">
                                        {game.completado ? (
                                            <div className="card-status status-won"><i className="fa-solid fa-trophy" style={{ marginRight: '8px' }}></i> COMPLETADO</div>
                                        ) : game.fase6 ? (
                                            <div className="card-status status-lost"><i className="fa-solid fa-skull" style={{ marginRight: '8px' }}></i> FALLADO</div>
                                        ) : (
                                            <div className="btn-primary" style={{ width: '100%', textAlign: 'center', fontSize: '0.8rem', padding: '0.8rem' }} onClick={() => startJuego(game)}>¡JUGAR!</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    selectedGame && (
                        <div className="judi_game_view" style={{ width: '100%', maxWidth: '1000px', display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center' }}>
                            {/* Header compacto */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', width: '100%' }}>
                                <button className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }} onClick={() => { setView('start'); router.push('/judi'); loadUserAndGames(); }}>← Volver</button>
                                <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>#{selectedGame.juego.id} — {selectedGame.juego.fecha}</div>
                            </div>

                            {/* Fases compactas */}
                            <div className="fases" style={{ gap: '0.4rem', marginBottom: '0.5rem', width: '100%', justifyContent: 'center' }}>
                                {[1, 2, 3, 4, 5, 6].map(f => (
                                    <div key={f} className={`fase ${f === activeViewedPhase ? 'active' : ''} ${f > highestUnlockedPhase && gameState === 'playing' ? 'locked' : ''}`} style={{ width: '35px', height: '35px', fontSize: '0.9rem' }} onClick={() => (f <= highestUnlockedPhase || gameState !== 'playing') && setActiveViewedPhase(f)}>
                                        {f <= highestUnlockedPhase || gameState !== 'playing' ? f : <i className="fa-solid fa-lock" style={{ fontSize: '0.6em' }}></i>}
                                    </div>
                                ))}
                            </div>

                            {/* Corazones compactos */}
                            <div className="hearts-container" style={{ padding: '0.3rem 1rem', marginBottom: '0.3rem', gap: '0.4rem', width: 'auto', margin: '0 auto 0.3rem auto' }}>
                                {[...Array(6)].map((_, i) => <i key={i} className={`fa-solid fa-heart ${i < lives ? '' : 'heart-empty'}`} style={{ color: i < lives ? '#ff4757' : 'rgba(255,255,255,0.2)', fontSize: '1.1rem' }}></i>)}
                            </div>

                            {gameState === 'playing' ? (
                                <>
                                    {/* Imagen ARRIBA */}
                                    <div className={`game-data-box glass-panel ${isImageExpanded ? 'expanded' : ''}`} onClick={() => setIsImageExpanded(!isImageExpanded)}>
                                        {selectedGame.capturas.length > 0 && <img src={selectedGame.capturas[activeViewedPhase === 1 ? 5 : activeViewedPhase - 2] || selectedGame.capturas[0]} alt="Pista" className="game-image" />}
                                        <div className="expand-hint">
                                            <i className="fa-solid fa-magnifying-glass-plus"></i> Clic para ampliar
                                        </div>
                                        {activeViewedPhase > 1 && (
                                            <div className="pista-overlay">
                                                {activeViewedPhase === 2 && <><i className="fa-solid fa-fire-pulse"></i> Popularidad: <strong>{selectedGame.juego.desarrollador} / 5</strong></>}
                                                {activeViewedPhase === 3 && <><i className="fa-solid fa-star"></i> Metacritic: <strong>{selectedGame.juego.calificacion} / 100</strong></>}
                                                {activeViewedPhase === 4 && <><i className="fa-solid fa-display"></i> {selectedGame.plataformas.join(', ')}</>}
                                                {activeViewedPhase === 5 && <><i className="fa-solid fa-tags"></i> {selectedGame.generos.join(', ')}</>}
                                                {activeViewedPhase === 6 && <><i className="fa-solid fa-calendar-days"></i> Lanzamiento: <strong>{selectedGame.juego.released}</strong></>}
                                            </div>
                                        )}
                                    </div>

                                    {/* Modal imagen expandida */}
                                    {isImageExpanded && (
                                        <div className="image-expanded-overlay" onClick={() => setIsImageExpanded(false)}>
                                            <div className="expanded-image-container">
                                                <img src={selectedGame.capturas[activeViewedPhase === 1 ? 5 : activeViewedPhase - 2] || selectedGame.capturas[0]} alt="Pista Ampliada" />
                                                <div className="close-expanded"><i className="fa-solid fa-xmark"></i></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Input y botón ABAJO */}
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', maxWidth: '700px', margin: '0.5rem auto 0 auto', width: '100%' }}>
                                        <div style={{ position: 'relative', flex: 1, maxWidth: '500px' }}>
                                            <input
                                                className="buscador-input"
                                                style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: '50px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.9rem' }}
                                                placeholder="¿Qué juego es?..."
                                                value={searchQuery}
                                                onChange={handleSearchInput}
                                                onFocus={() => setShowResults(true)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAdivinar()}
                                            />
                                            {showResults && searchResults.length > 0 && (
                                                <div className="autocomplete-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#050a0f', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', marginTop: '5px', maxHeight: '120px', overflowY: 'auto' }}>
                                                    {searchResults.map((res: any) => <div key={res.id} style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' }} onMouseDown={() => { setSearchQuery(res.name); setShowResults(false); }}>{res.name}</div>)}
                                                </div>
                                            )}
                                        </div>
                                        <button className="btn-primary" onClick={handleAdivinar} style={{ borderRadius: '50px', padding: '0.6rem 1.8rem', fontSize: '0.95rem', fontWeight: '800', whiteSpace: 'nowrap' }}>ADIVINAR</button>
                                    </div>

                                    {/* Lista de intentos fallidos */}
                                    {wrongGuesses.length > 0 && (
                                        <div className="wrong-guesses-list" style={{ marginTop: '0.8rem', width: '100%', maxWidth: '700px', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
                                            {wrongGuesses.map((guess, idx) => (
                                                <div key={idx} className="wrong-guess-tag" style={{ background: 'rgba(255, 71, 87, 0.1)', color: '#ff4757', padding: '0.3rem 0.8rem', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid rgba(255, 71, 87, 0.2)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    <i className="fa-solid fa-xmark" style={{ fontSize: '0.7rem' }}></i> {guess}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* Imagen resultado */}
                                    <div className="game-data-box glass-panel" style={{ marginBottom: '0.8rem' }}>
                                        {selectedGame.capturas.length > 0 && <img src={selectedGame.capturas[activeViewedPhase === 1 ? 5 : activeViewedPhase - 2] || selectedGame.capturas[0]} alt="Pista" className="game-image" />}
                                        {activeViewedPhase > 1 && (
                                            <div className="pista-overlay">
                                                {activeViewedPhase === 2 && <><i className="fa-solid fa-fire-pulse"></i> Popularidad: <strong>{selectedGame.juego.desarrollador} / 5</strong></>}
                                                {activeViewedPhase === 3 && <><i className="fa-solid fa-star"></i> Metacritic: <strong>{selectedGame.juego.calificacion} / 100</strong></>}
                                                {activeViewedPhase === 4 && <><i className="fa-solid fa-display"></i> {selectedGame.plataformas.join(', ')}</>}
                                                {activeViewedPhase === 5 && <><i className="fa-solid fa-tags"></i> {selectedGame.generos.join(', ')}</>}
                                                {activeViewedPhase === 6 && <><i className="fa-solid fa-calendar-days"></i> Lanzamiento: <strong>{selectedGame.juego.released}</strong></>}
                                            </div>
                                        )}
                                    </div>

                                    {/* Resultado final compacto */}
                                    <div className="resultado-final glass-panel" style={{ textAlign: 'center', padding: '1.5rem', borderRadius: '20px', border: `1px solid ${gameState === 'won' ? '#2ed573' : '#ff4757'}`, background: gameState === 'won' ? 'rgba(46, 213, 115, 0.05)' : 'rgba(255, 71, 87, 0.05)' }}>
                                        <h2 style={{ color: gameState === 'won' ? '#2ed573' : '#ff4757', fontSize: '1.6rem', marginBottom: '0.8rem', margin: 0 }}>{gameState === 'won' ? '¡VICTORIA!' : 'DERROTA'}</h2>
                                        <p style={{ marginBottom: '1rem', fontSize: '1rem', margin: '0.8rem 0' }}>El juego era: <strong>{selectedGame.juego.nombre}</strong></p>
                                        <button className="btn-primary" style={{ padding: '0.7rem 2rem' }} onClick={() => { setView('start'); router.push('/judi'); loadUserAndGames(); }}>Jugar otro</button>
                                    </div>
                                </>
                            )}
                        </div>
                    )
                )}
            </div>
        </div>
    )
}


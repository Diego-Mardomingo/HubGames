'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { searchGames, type Game } from '@/lib/rawg'
import GameCard from './GameCard'
import Loader from './Loader'

const GENRES = {
    Action: 'Acción',
    Indie: 'Indie',
    Adventure: 'Aventuras',
    RPG: 'RPG',
    Strategy: 'Estrategia',
    Shooter: 'Shooter',
    Simulation: 'Simulación',
    Platformer: 'Plataformas',
}

const PLATFORMS: { [key: string]: string } = {
    '4': 'PC',
    '187': 'PlayStation 5',
    '18': 'PlayStation 4',
    '16': 'PlayStation 3',
    '1': 'Xbox One',
    '186': 'Xbox Series S/X',
    '14': 'Xbox 360',
    '7': 'Nintendo Switch',
    '8': 'Nintendo 3DS',
    '21': 'Android',
    '3': 'iOS',
}

export default function GameSearch() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '')
    const [games, setGames] = useState<Game[]>([])
    const [loading, setLoading] = useState(false)
    const [showFilters, setShowFilters] = useState(false)
    const [activeGenres, setActiveGenres] = useState<string[]>(searchParams.get('genres')?.split(',').filter(Boolean) || [])
    const [activePlatforms, setActivePlatforms] = useState<string[]>(searchParams.get('platforms')?.split(',').filter(Boolean) || [])
    const [dateStart, setDateStart] = useState(searchParams.get('start') || '2000-01-01')
    const [dateEnd, setDateEnd] = useState(searchParams.get('end') || (() => {
        const futureDate = new Date()
        futureDate.setMonth(futureDate.getMonth() + 6)
        return futureDate.toISOString().split('T')[0]
    })())
    const [nextPage, setNextPage] = useState<string | null>(null)
    const [prevPage, setPrevPage] = useState<string | null>(null)
    const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'))

    const handleSearch = useCallback(async (page = 1, updateUrl = true) => {
        setLoading(true)
        try {
            const params: any = {
                search: searchTerm || undefined,
                genres: activeGenres.length > 0 ? activeGenres.map(g => g.toLowerCase()).join(',') : undefined,
                platforms: activePlatforms.length > 0 ? activePlatforms.join(',') : undefined,
                dates: dateEnd ? `${dateStart},${dateEnd}` : undefined,
                ordering: searchTerm ? undefined : '-added',
                page,
            }

            // Sync with URL if requested
            if (updateUrl) {
                const newParams = new URLSearchParams()
                if (searchTerm) newParams.set('q', searchTerm)
                if (activeGenres.length > 0) newParams.set('genres', activeGenres.join(','))
                if (activePlatforms.length > 0) newParams.set('platforms', activePlatforms.join(','))
                if (dateStart !== '2000-01-01') newParams.set('start', dateStart)
                if (dateEnd) newParams.set('end', dateEnd)
                if (page > 1) newParams.set('page', String(page))

                const query = newParams.toString()
                router.push(query ? `?${query}` : '/')
            }

            const response = await searchGames(params)
            setGames(response.results)
            setNextPage(response.next)
            setPrevPage(response.previous)
            setCurrentPage(page)
        } catch (error) {
            console.error('Error searching games:', error)
        } finally {
            setLoading(false)
        }
    }, [searchTerm, activeGenres, activePlatforms, dateStart, dateEnd, router])

    useEffect(() => {
        // Initial search load
        handleSearch(currentPage, false)
    }, []) // Run once on mount

    const toggleGenre = (genre: string) => {
        setActiveGenres((prev) =>
            prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
        )
    }

    const togglePlatform = (platform: string) => {
        setActivePlatforms((prev) =>
            prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
        )
    }

    const removeFilter = (type: 'genre' | 'platform', value: string) => {
        if (type === 'genre') {
            setActiveGenres((prev) => prev.filter((g) => g !== value))
        } else {
            setActivePlatforms((prev) => prev.filter((p) => p !== value))
        }
    }

    const clearAllFilters = () => {
        setActiveGenres([])
        setActivePlatforms([])
    }

    const resetDates = () => {
        setDateStart('2000-01-01')
        const futureDate = new Date()
        futureDate.setMonth(futureDate.getMonth() + 6)
        setDateEnd(futureDate.toISOString().split('T')[0])
    }

    return (
        <>
            <div className="cuerpo_cabecera" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8em', marginBottom: '1em' }}>
                <div className="buscador_container">
                    <i className="fa-solid fa-magnifying-glass"></i>
                    <input
                        type="text"
                        id="buscador_videojuegos"
                        spellCheck="false"
                        placeholder=" ¿Qué buscamos?"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyUp={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    {searchTerm && (
                        <i
                            className="fa-solid fa-xmark"
                            id="limpiar_buscador"
                            style={{ display: 'block' }}
                            onClick={() => setSearchTerm('')}
                        ></i>
                    )}
                </div>

                <div className="filtro_container">
                    <div className="boton_filtros" onClick={() => setShowFilters(!showFilters)}>
                        Filtrar
                        <i className="fa-solid fa-angles-down"></i>
                    </div>
                    {showFilters && (
                        <div className="mostrar_filtros">
                            <div className="encabezado_filtros">Fecha lanzamiento:</div>
                            <div className="cuerpo_filtros_fecha">
                                <div>
                                    Desde:{' '}
                                    <input
                                        type="date"
                                        value={dateStart}
                                        onChange={(e) => setDateStart(e.target.value)}
                                        min="1990-01-01"
                                    />
                                </div>
                                <div>
                                    Hasta:{' '}
                                    <input
                                        type="date"
                                        value={dateEnd}
                                        onChange={(e) => setDateEnd(e.target.value)}
                                        min="1990-01-01"
                                    />
                                </div>
                                <div className="reinicio_fechas" onClick={resetDates}>
                                    Reiniciar fechas
                                </div>
                            </div>

                            <div className="encabezado_filtros">Géneros:</div>
                            <div className="cuerpo_filtros">
                                {Object.entries(GENRES).map(([key, value]) => (
                                    <div
                                        key={key}
                                        className={`genero ${activeGenres.includes(key) ? 'filtro_activado' : ''}`}
                                        onClick={() => toggleGenre(key)}
                                    >
                                        {value}
                                    </div>
                                ))}
                            </div>

                            <div className="encabezado_filtros">Plataformas:</div>
                            <div className="cuerpo_filtros">
                                {Object.entries(PLATFORMS).map(([key, value]) => (
                                    <div
                                        key={key}
                                        className={`plataforma ${activePlatforms.includes(key) ? 'filtro_activado' : ''}`}
                                        onClick={() => togglePlatform(key)}
                                    >
                                        {value}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="buscador_boton" onClick={() => handleSearch()}>
                    <i className="fa-solid fa-magnifying-glass"></i>
                    Buscar
                </div>
            </div>

            {/* Active Filters */}
            {(activeGenres.length > 0 || activePlatforms.length > 0) && (
                <div className="filtros_activos_container">
                    {activeGenres.map((genre) => (
                        <div key={genre} className="filtro_activo">
                            <i className="fa-solid fa-xmark" onClick={() => removeFilter('genre', genre)}></i>
                            {GENRES[genre as keyof typeof GENRES]}
                        </div>
                    ))}
                    {activePlatforms.map((platform) => (
                        <div key={platform} className="filtro_activo">
                            <i className="fa-solid fa-xmark" onClick={() => removeFilter('platform', platform)}></i>
                            {PLATFORMS[platform]}
                        </div>
                    ))}
                    {(activeGenres.length + activePlatforms.length >= 3) && (
                        <div id="borrar_todos_filtros" className="filtro_activo" onClick={clearAllFilters}>
                            Borrar filtros
                        </div>
                    )}
                </div>
            )}

            {/* Pagination */}
            <div className="enlaces_paginas">
                <div className="pag_anterior">
                    {prevPage && (
                        <div className="anterior_pagina" onClick={() => handleSearch(currentPage - 1)}>
                            <i className="fa-solid fa-circle-arrow-left"></i>
                            Página anterior
                        </div>
                    )}
                </div>
                <div className="pag_siguiente">
                    {nextPage && (
                        <div className="siguiente_pagina" onClick={() => handleSearch(currentPage + 1)}>
                            Página siguiente
                            <i className="fa-solid fa-circle-arrow-right"></i>
                        </div>
                    )}
                </div>
            </div>

            {/* Games Grid */}
            <div className="juegos">
                {loading ? (
                    <Loader />
                ) : games.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#fff' }}>
                        No se encontraron juegos
                    </div>
                ) : (
                    games.map((game) => <GameCard key={game.id} game={game} />)
                )}
            </div>
        </>
    )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { searchGames, type Game } from '@/lib/rawg'
import GameCard from './GameCard'
import Loader from './Loader'

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
}

export default function GameSearch() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // 1. Derive values from URL (Source of Truth)
    const q = searchParams.get('q') || ''
    const platformsParam = searchParams.get('platforms') || ''
    const metacriticValParam = searchParams.get('metacritic_value') || ''
    const metacriticOpParam = searchParams.get('metacritic_op') || '>='
    const startParam = searchParams.get('start') || '2000-01-01'
    const endParam = searchParams.get('end') || (() => {
        const futureDate = new Date()
        futureDate.setMonth(futureDate.getMonth() + 6)
        return futureDate.toISOString().split('T')[0]
    })()
    const pageParam = parseInt(searchParams.get('page') || '1')

    // 2. Local state for draft filters (only what's in input fields)
    const [searchTerm, setSearchTerm] = useState(q)
    const [activePlatforms, setActivePlatforms] = useState<string[]>(platformsParam.split(',').filter(Boolean))
    const [minMetacritic, setMinMetacritic] = useState(metacriticValParam)
    const [metacriticOperator, setMetacriticOperator] = useState(metacriticOpParam)
    const [dateStart, setDateStart] = useState(startParam)
    const [dateEnd, setDateEnd] = useState(endParam)

    // 3. Results state
    const [games, setGames] = useState<Game[]>([])
    const [loading, setLoading] = useState(true) // Start loading on mount
    const [showFilters, setShowFilters] = useState(false)
    const [nextPage, setNextPage] = useState<string | null>(null)
    const [prevPage, setPrevPage] = useState<string | null>(null)

    // 4. Sync local state when URL changes (Back button support)
    useEffect(() => {
        setSearchTerm(q)
        setActivePlatforms(platformsParam.split(',').filter(Boolean))
        setMinMetacritic(metacriticValParam)
        setMetacriticOperator(metacriticOpParam)
        setDateStart(startParam)
        setDateEnd(endParam)
    }, [q, platformsParam, metacriticValParam, metacriticOpParam, startParam, endParam])

    // 5. Centralized update function (Updates URL)
    const updateUrl = useCallback((updates: any) => {
        const params = new URLSearchParams(searchParams.toString())

        Object.entries(updates).forEach(([key, value]) => {
            if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
                params.delete(key)
            } else {
                params.set(key, String(value))
            }
        })

        // Reset page on filter changes (if page not explicitly updated)
        if (!updates.page) params.delete('page')

        const query = params.toString()
        router.push(query ? `?${query}` : '/')
    }, [router, searchParams])

    // 6. Effect to fetch data whenever URL params change
    useEffect(() => {
        const fetchResults = async () => {
            setLoading(true)
            try {
                let metacriticParam = undefined
                if (metacriticValParam) {
                    const value = parseInt(metacriticValParam)
                    if (metacriticOpParam === '>=') metacriticParam = `${value},100`
                    else if (metacriticOpParam === '<=') metacriticParam = `0,${value}`
                    else metacriticParam = `${value},${value}`
                }

                const response = await searchGames({
                    search: q || undefined,
                    platforms: platformsParam || undefined,
                    exclude_platforms: '21,3',
                    dates: endParam ? `${startParam},${endParam}` : undefined,
                    metacritic: metacriticParam,
                    ordering: q ? undefined : '-added',
                    page: pageParam,
                })

                setGames(response.results)
                setNextPage(response.next)
                setPrevPage(response.previous)

                // Scroll to top on page change
                window.scrollTo({ top: 0, behavior: 'smooth' })
            } catch (error) {
                console.error('Error searching games:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchResults()
    }, [q, platformsParam, metacriticValParam, metacriticOpParam, startParam, endParam, pageParam])

    const togglePlatform = (platform: string) => {
        setActivePlatforms((prev) =>
            prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
        )
    }

    const clearAllFilters = () => {
        setActivePlatforms([])
        setMinMetacritic('')
        updateUrl({ platforms: [], metacritic_value: '' })
    }

    const applyFilters = () => {
        updateUrl({
            q: searchTerm,
            platforms: activePlatforms.join(','),
            metacritic_value: minMetacritic,
            metacritic_op: metacriticOperator,
            start: dateStart,
            end: dateEnd,
            page: 1
        })
        setShowFilters(false)
    }

    const removeFilter = (platform: string) => {
        const newPlatforms = activePlatforms.filter((p) => p !== platform)
        setActivePlatforms(newPlatforms)
        updateUrl({ platforms: newPlatforms.join(',') })
    }

    const resetDates = () => {
        const futureDate = new Date()
        futureDate.setMonth(futureDate.getMonth() + 6)
        const defaultEnd = futureDate.toISOString().split('T')[0]
        setDateStart('2000-01-01')
        setDateEnd(defaultEnd)
    }

    return (
        <>
            <h1 className="sr-only">Buscador de Videojuegos HubGames</h1>
            <div className="cuerpo_cabecera">
                <div style={{ display: 'flex', gap: '1em', width: '100%', flexWrap: 'wrap' }}>
                    <div className="buscador_container" style={{ flexGrow: 1 }}>
                        <i
                            className="fa-solid fa-magnifying-glass"
                            style={{ cursor: 'pointer' }}
                            onClick={applyFilters}
                        ></i>
                        <input
                            type="text"
                            id="buscador_videojuegos"
                            spellCheck="false"
                            autoComplete="off"
                            placeholder="¿Qué buscamos?"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyUp={(e) => e.key === 'Enter' && applyFilters()}
                        />
                        {searchTerm && (
                            <i
                                className="fa-solid fa-circle-xmark"
                                style={{ cursor: 'pointer', opacity: 0.6 }}
                                onClick={() => { setSearchTerm(''); updateUrl({ q: '' }); }}
                            ></i>
                        )}
                    </div>

                    <div className="filtro_container">
                        <div className="boton_filtros" onClick={() => setShowFilters(!showFilters)}>
                            <i className="fa-solid fa-filter"></i>
                            Filtrar
                            <i className={`fa-solid fa-chevron-${showFilters ? 'up' : 'down'}`} style={{ fontSize: '0.8em', opacity: 0.7 }}></i>
                        </div>
                        {showFilters && (
                            <div className="mostrar_filtros glass-panel">
                                {/* Fecha lanzamiento - Full width */}
                                <div className="filter-section full-width">
                                    <div className="encabezado_filtros">Fecha lanzamiento</div>
                                    <div className="cuerpo_filtros_fecha">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4em' }}>
                                            <label style={{ fontSize: '0.7em', color: 'rgba(255,255,255,0.5)' }}>Desde</label>
                                            <input
                                                type="date"
                                                value={dateStart}
                                                onChange={(e) => setDateStart(e.target.value)}
                                                min="1990-01-01"
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4em' }}>
                                            <label style={{ fontSize: '0.7em', color: 'rgba(255,255,255,0.5)' }}>Hasta</label>
                                            <input
                                                type="date"
                                                value={dateEnd}
                                                onChange={(e) => setDateEnd(e.target.value)}
                                                min="1990-01-01"
                                            />
                                        </div>
                                        <div className="reinicio_fechas" onClick={resetDates}>
                                            <i className="fa-solid fa-rotate-left"></i> Reiniciar fechas
                                        </div>
                                    </div>
                                </div>

                                {/* Metacritic - Left column */}
                                <div className="filter-section">
                                    <div className="encabezado_filtros">Nota Metacritic</div>
                                    <div className="cuerpo_filtros_fecha" style={{ display: 'flex', gap: '0.5em' }}>
                                        <select
                                            value={metacriticOperator}
                                            onChange={(e) => setMetacriticOperator(e.target.value)}
                                            style={{
                                                padding: '0.75em',
                                                borderRadius: '8px',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                                color: '#fff',
                                                fontSize: '1rem',
                                                width: '80px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value=">=" style={{ backgroundColor: '#00171F', color: '#fff' }}>&gt;=</option>
                                            <option value="<=" style={{ backgroundColor: '#00171F', color: '#fff' }}>&lt;=</option>
                                            <option value="=" style={{ backgroundColor: '#00171F', color: '#fff' }}>=</option>
                                        </select>
                                        <input
                                            type="number"
                                            placeholder="75"
                                            value={minMetacritic}
                                            onChange={(e) => setMinMetacritic(e.target.value)}
                                            min="0"
                                            max="100"
                                            style={{
                                                flex: 1,
                                                padding: '0.75em',
                                                borderRadius: '8px',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                                color: '#fff',
                                                fontSize: '1rem'
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Plataformas - Right column */}
                                <div className="filter-section">
                                    <div className="encabezado_filtros">Plataformas</div>
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

                                <div className="filter-actions" style={{ gridColumn: '1 / -1', marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                                    <button
                                        className="btn-primary"
                                        style={{ flex: 1, borderRadius: '8px' }}
                                        onClick={applyFilters}
                                    >
                                        APLICAR FILTROS
                                    </button>
                                    <button
                                        className="btn-secondary"
                                        style={{ flex: 0.5, borderRadius: '8px' }}
                                        onClick={clearAllFilters}
                                    >
                                        Limpiar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="buscador_boton" onClick={applyFilters}>
                        <i className="fa-solid fa-magnifying-glass"></i>
                    </div>
                </div>
            </div>

            {/* Active Filters */}
            {activePlatforms.length > 0 && (
                <div className="filtros_activos_container">
                    {activePlatforms.map((platform) => (
                        <div key={platform} className="filtro_activo">
                            <i className="fa-solid fa-xmark" onClick={() => removeFilter(platform)}></i>
                            {PLATFORMS[platform]}
                        </div>
                    ))}
                    {activePlatforms.length >= 3 && (
                        <div id="borrar_todos_filtros" className="filtro_activo" onClick={clearAllFilters}>
                            Borrar filtros
                        </div>
                    )}
                </div>
            )}


            {/* Games Grid */}
            <div className="juegos">
                {loading ? (
                    <Loader />
                ) : games.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#fff' }}>
                        No se encontraron juegos
                    </div>
                ) : (
                    games.map((game, index) => <GameCard key={game.id} game={game} priority={index < 4} />)
                )}
            </div>

            {/* Bottom Pagination */}
            {(nextPage || prevPage) && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '1.5em',
                    marginTop: '2em',
                    padding: '1em 0',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                    {prevPage && (
                        <div
                            className="boton_pag_mini"
                            onClick={() => updateUrl({ page: pageParam - 1 })}
                            title="Página anterior"
                            style={{ cursor: 'pointer' }}
                        >
                            <i className="fa-solid fa-chevron-left"></i>
                        </div>
                    )}
                    <div style={{
                        color: '#00A8E8',
                        fontSize: '1em',
                        fontWeight: '700',
                        padding: '0 1em'
                    }}>
                        Página {pageParam}
                    </div>
                    {nextPage && (
                        <div
                            className="boton_pag_mini"
                            onClick={() => updateUrl({ page: pageParam + 1 })}
                            title="Página siguiente"
                            style={{ cursor: 'pointer' }}
                        >
                            <i className="fa-solid fa-chevron-right"></i>
                        </div>
                    )}
                </div>
            )}
        </>
    )
}

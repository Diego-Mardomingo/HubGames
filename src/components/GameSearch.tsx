'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
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
    const sortByMetacriticParam = searchParams.get('sort_metacritic') === 'true'
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
    const [sortByMetacritic, setSortByMetacritic] = useState(sortByMetacriticParam)
    const [dateStart, setDateStart] = useState(startParam)
    const [dateEnd, setDateEnd] = useState(endParam)

    // 3. Results state
    const [games, setGames] = useState<Game[]>([])
    const [loading, setLoading] = useState(true) // Start loading on mount
    const [showFilters, setShowFilters] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [showPlatforms, setShowPlatforms] = useState(false)
    const [nextPage, setNextPage] = useState<string | null>(null)
    const [prevPage, setPrevPage] = useState<string | null>(null)

    useEffect(() => {
        setMounted(true)
        const checkMobile = () => setIsMobile(window.innerWidth <= 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // 4. Sync local state when URL changes (Back button support)
    useEffect(() => {
        setSearchTerm(q)
        setActivePlatforms(platformsParam.split(',').filter(Boolean))
        setMinMetacritic(metacriticValParam)
        setMetacriticOperator(metacriticOpParam)
        setSortByMetacritic(sortByMetacriticParam)
        setDateStart(startParam)
        setDateEnd(endParam)
    }, [q, platformsParam, metacriticValParam, metacriticOpParam, sortByMetacriticParam, startParam, endParam])

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

                // Determine ordering: metacritic sort takes priority if enabled
                let orderingParam = q ? undefined : '-added'
                if (sortByMetacriticParam) {
                    orderingParam = '-metacritic'
                }

                const response = await searchGames({
                    search: q || undefined,
                    platforms: platformsParam || undefined,
                    exclude_platforms: '21,3',
                    dates: endParam ? `${startParam},${endParam}` : undefined,
                    metacritic: metacriticParam,
                    ordering: orderingParam,
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
    }, [q, platformsParam, metacriticValParam, metacriticOpParam, sortByMetacriticParam, startParam, endParam, pageParam])

    const togglePlatform = (platform: string) => {
        setActivePlatforms((prev) =>
            prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
        )
    }

    const clearAllFilters = () => {
        setActivePlatforms([])
        setMinMetacritic('')
        setSortByMetacritic(false)
        updateUrl({ platforms: [], metacritic_value: '', sort_metacritic: '' })
    }

    const applyFilters = () => {
        updateUrl({
            q: searchTerm,
            platforms: activePlatforms.join(','),
            metacritic_value: minMetacritic,
            metacritic_op: metacriticOperator,
            sort_metacritic: sortByMetacritic ? 'true' : '',
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

    const modalJSX = (
        <div className="mostrar_filtros glass-panel">

            <div className="filter-section full-width">
                <div className="encabezado_filtros">Fecha lanzamiento</div>
                <div className="cuerpo_filtros_fecha">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4em' }}>
                        <label style={{ fontSize: '0.7em', color: 'rgba(255,255,255,0.5)' }}>Desde</label>
                        <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} min="1990-01-01" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4em' }}>
                        <label style={{ fontSize: '0.7em', color: 'rgba(255,255,255,0.5)' }}>Hasta</label>
                        <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} min="1990-01-01" />
                    </div>
                    <button className="btn-secondary" onClick={resetDates} style={{ marginTop: '1rem', width: '100%', padding: '0.6em', fontSize: '0.9em', borderRadius: '8px' }}>
                        <i className="fa-solid fa-rotate-left"></i> Reiniciar fechas
                    </button>
                </div>
            </div>

            <div className="filter-section">
                <div className="encabezado_filtros">Nota Metacritic</div>
                <div className="cuerpo_filtros_fecha" style={{ display: 'flex', gap: '0.5em', flexWrap: 'wrap' }}>
                    <select value={metacriticOperator} onChange={(e) => setMetacriticOperator(e.target.value)} style={{ padding: '0.75em', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#fff', fontSize: '0.9em', width: '140px', cursor: 'pointer' }}>
                        <option value=">=" style={{ backgroundColor: '#00171F', color: '#fff' }}>Mayor o igual</option>
                        <option value="<=" style={{ backgroundColor: '#00171F', color: '#fff' }}>Menor o igual</option>
                        <option value="=" style={{ backgroundColor: '#00171F', color: '#fff' }}>Igual a</option>
                    </select>
                    <input type="number" value={minMetacritic} onChange={(e) => setMinMetacritic(e.target.value)} min="0" max="100" style={{ flex: 1, padding: '0.75em', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#fff', fontSize: '1rem', minWidth: '80px' }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6em', marginTop: '0.8rem', cursor: 'pointer', fontSize: '0.9em', color: 'rgba(255,255,255,0.8)' }}>
                    <input type="checkbox" checked={sortByMetacritic} onChange={(e) => setSortByMetacritic(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#00A8E8', cursor: 'pointer' }} />
                    <i className="fa-solid fa-arrow-down-wide-short" style={{ color: '#00A8E8' }}></i>
                    Ordenar de mayor a menor por nota Metacritic
                </label>
            </div>

            <div className="filter-section full-width">
                <div className="encabezado_filtros" onClick={() => setShowPlatforms(!showPlatforms)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5em 0', borderBottom: showPlatforms ? '1px solid rgba(255,255,255,0.1)' : 'none', marginBottom: showPlatforms ? '1rem' : '0' }}>
                    <span>Plataformas</span>
                    <i className={`fa-solid fa-chevron-${showPlatforms ? 'up' : 'down'}`} style={{ fontSize: '0.8em', opacity: 0.7 }}></i>
                </div>
                {showPlatforms && (
                    <div className="cuerpo_filtros platform-buttons-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.8rem' }}>
                        {Object.entries(PLATFORMS).map(([key, value]) => (
                            <div key={key} className={`plataforma ${activePlatforms.includes(key) ? 'filtro_activado' : ''}`} onClick={() => togglePlatform(key)} style={{ textAlign: 'center', padding: '0.8em 0.5em', fontSize: '0.9em', cursor: 'pointer' }}>
                                {value}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="filter-actions" style={{ gridColumn: '1 / -1', marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                <button className="btn-primary" style={{ flex: 1, borderRadius: '8px' }} onClick={applyFilters}>APLICAR FILTROS</button>
                <button className="btn-secondary" style={{ flex: 0.5, borderRadius: '8px' }} onClick={clearAllFilters}>Limpiar</button>
            </div>
        </div>
    )

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

                    <div style={{ position: 'relative', width: '100%' }}>
                        <div className="filtro_container">
                            <div className="boton_filtros" onClick={() => setShowFilters(!showFilters)}>
                                <i className="fa-solid fa-filter"></i>
                                Filtrar
                                <i className={`fa-solid fa-chevron-${showFilters ? 'up' : 'down'}`} style={{ fontSize: '0.8em', opacity: 0.7 }}></i>
                            </div>

                            <div className="buscador_boton" onClick={applyFilters}>
                                <i className="fa-solid fa-magnifying-glass"></i>
                                <span className="btn-text">Buscar</span>
                            </div>
                        </div>

                        {showFilters && modalJSX}
                    </div>
                </div>
            </div >

            {/* Active Filters */}
            {
                activePlatforms.length > 0 && (
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
                )
            }


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
            {
                (nextPage || prevPage) && (
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
                )
            }
        </>
    )
}

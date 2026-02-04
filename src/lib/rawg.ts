const RAWG_API_KEY = process.env.NEXT_PUBLIC_RAWG_API_KEY!
const RAWG_BASE_URL = 'https://api.rawg.io/api'

export interface Game {
    id: number
    name: string
    background_image: string
    released: string
    metacritic: number
    genres: Array<{ id: number; name: string }>
    platforms: Array<{ platform: { id: number; name: string } }>
}

export interface GameDetails extends Game {
    description_raw: string
    developers: Array<{ id: number; name: string }>
    rating: number
}

export interface SearchParams {
    search?: string
    genres?: string
    platforms?: string
    dates?: string
    page?: number
    page_size?: number
}

export async function searchGames(params: SearchParams) {
    const queryParams = new URLSearchParams({
        key: RAWG_API_KEY,
        page_size: String(params.page_size || 20),
        search_exact: 'true',
        exclude_additions: 'true',
        ordering: '-added',
        page: String(params.page || 1),
    })

    if (params.search) queryParams.append('search', params.search)
    if (params.genres) queryParams.append('genres', params.genres)
    if (params.platforms) queryParams.append('platforms', params.platforms)
    if (params.dates) queryParams.append('dates', params.dates)

    const response = await fetch(`${RAWG_BASE_URL}/games?${queryParams}`)
    if (!response.ok) throw new Error('Failed to fetch games')

    return response.json()
}

export async function getGameDetails(id: number) {
    const response = await fetch(`${RAWG_BASE_URL}/games/${id}?key=${RAWG_API_KEY}`)
    if (!response.ok) throw new Error('Failed to fetch game details')

    return response.json()
}

export async function getGameScreenshots(id: number) {
    const response = await fetch(`${RAWG_BASE_URL}/games/${id}/screenshots?key=${RAWG_API_KEY}`)
    if (!response.ok) throw new Error('Failed to fetch screenshots')

    return response.json()
}

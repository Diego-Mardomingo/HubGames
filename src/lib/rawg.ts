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
    exclude_platforms?: string
    dates?: string
    metacritic?: string
    page?: number
    page_size?: number
    ordering?: string
}

export async function searchGames(params: SearchParams) {
    const queryParams: any = {
        key: RAWG_API_KEY,
        page_size: String(params.page_size || 20),
        exclude_additions: 'true',
        page: String(params.page || 1),
    }

    // Quality filters to exclude low-quality games
    // Only apply when not searching for a specific game
    if (!params.search) {
        // Require at least some ratings to filter out obscure/low-quality games
        // Using a low threshold (3) to not be too restrictive
        queryParams.ratings_count = '3'
    }

    if (params.ordering) queryParams.ordering = params.ordering

    if (params.search) {
        queryParams.search = params.search
        queryParams.search_precise = 'true'
    }
    if (params.genres) queryParams.genres = params.genres
    if (params.platforms) queryParams.platforms = params.platforms
    if (params.exclude_platforms) queryParams.exclude_platforms = params.exclude_platforms
    if (params.dates) queryParams.dates = params.dates
    if (params.metacritic) queryParams.metacritic = params.metacritic

    const urlParams = new URLSearchParams(queryParams)
    const response = await fetch(`${RAWG_BASE_URL}/games?${urlParams}`)
    if (!response.ok) throw new Error('Failed to fetch games')

    const data = await response.json()

    // Filter out games without images on the client side
    // This ensures all displayed games have proper visuals
    if (data.results) {
        data.results = data.results.filter((game: Game) => game.background_image)
    }

    return data
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

export interface Game {
    id: number
    name: string
    background_image: string
    released: string
    metacritic: number | null
    genres: Array<{ id: number; name: string }>
    platforms: Array<{ platform: { id: number; name: string } }>
}

export interface GameDetails extends Game {
    description_raw: string
    developers: Array<{ id: number; name: string }>
    publishers?: Array<{ id: number; name: string }>
    rating: number
    tags?: Array<{ id: number; name: string }>
    background_image_additional?: string
    esrb_rating?: { name: string } | null
    playtime?: number
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

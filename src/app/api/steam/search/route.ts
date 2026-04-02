import { NextRequest, NextResponse } from 'next/server'
import { searchGames } from '@/lib/steam'
import type { SearchParams } from '@/lib/game-types'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)

        const params: SearchParams = {
            search: searchParams.get('search') || undefined,
            platforms: searchParams.get('platforms') || undefined,
            exclude_platforms: searchParams.get('exclude_platforms') || undefined,
            dates: searchParams.get('dates') || undefined,
            metacritic: searchParams.get('metacritic') || undefined,
            page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
            page_size: searchParams.get('page_size') ? Number(searchParams.get('page_size')) : 20,
            ordering: searchParams.get('ordering') || undefined,
        }

        const data = await searchGames(params)
        return NextResponse.json(data)
    } catch (error) {
        console.error('Steam search API error:', error)
        return NextResponse.json(
            { error: 'Failed to search Steam games' },
            { status: 500 }
        )
    }
}

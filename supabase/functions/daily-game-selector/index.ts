import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RAWG_API_KEY = Deno.env.get('RAWG_API_KEY') ?? ""
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ""

serve(async (req) => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    try {
        const game = await obtenerJuegoRandom()
        await insertarJuegoRandom(supabase, game)

        return new Response(JSON.stringify({ success: true, game: game.name }), {
            headers: { "Content-Type": "application/json" },
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        })
    }
})

async function obtenerJuegoRandom() {
    const url = 'https://api.rawg.io/api/games'
    let randomGame = null
    let attempts = 0

    while (!randomGame && attempts < 20) {
        attempts++
        const page = Math.floor(Math.random() * 150) + 1
        const response = await fetch(`${url}?key=${RAWG_API_KEY}&ordering=-rating&page_size=50&page=${page}&exclude_additions=true`)
        const data = await response.json()

        const filteredGames = data.results.filter((g: any) =>
            g.reviews_count >= 300 && g.short_screenshots && g.short_screenshots.length >= 6
        )

        if (filteredGames.length > 0) {
            randomGame = filteredGames[Math.floor(Math.random() * filteredGames.length)]
        }
    }

    if (!randomGame) throw new Error("Could not find a suitable random game")
    return randomGame
}

async function insertarJuegoRandom(supabase: any, game: any) {
    const today = new Date().toISOString().split('T')[0]
    const [year, month, day] = today.split('-')
    const formattedDate = `${day}-${month}-${year}`

    const { data: insertedGame, error: gameError } = await supabase
        .from('hubgames_lista_videojuegos_judi')
        .insert({
            id_videojuego: game.id,
            nombre: game.name,
            fecha: formattedDate,
            calificacion: game.metacritic || 0,
            desarrollador: String(game.rating), // Fixed logic from PHP: it was saving rating in desarrollador col
            released: game.released,
        })
        .select()
        .single()

    if (gameError) throw gameError

    // Platforms
    const platforms = game.platforms.map((p: any) => ({ platform: p.platform.name }))
    for (const p of platforms) {
        // Ensure platform exists in catalog
        await supabase.from('hubgames_plataformas').upsert({ plataforma: p.platform }).select()
        await supabase.from('hubgames_videojuego_plataforma').upsert({
            id_videojuego: game.id,
            plataforma: p.platform
        })
    }

    // Genres
    const genres = game.genres.map((g: any) => ({ genre: g.name }))
    for (const g of genres) {
        // Ensure genre exists in catalog
        await supabase.from('hubgames_generos').upsert({ genero: g.genre }).select()
        await supabase.from('hubgames_videojuego_genero').upsert({
            id_videojuego: game.id,
            genero: g.genre
        })
    }

    // Screenshots
    const screenshots = game.short_screenshots.slice(0, 7).map((s: any) => ({
        captura: s.image,
        id_videojuego: game.id
    }))
    await supabase.from('hubgames_capturas').upsert(screenshots)
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { Award, Clock, Flag, Gamepad2, LogIn, Star, Trophy } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { loadDashboard } from '@/lib/dashboard-db'
import { buildHeatmap, heatmapStart, madridDate } from '@/lib/activity-heatmap'
import { Button } from '@/components/ui/button'
import Dashboard from '@/components/dashboard/Dashboard'
import ActivityHeatmap from '@/components/dashboard/ActivityHeatmap'
import LandingPreview from '@/components/dashboard/LandingPreview'
import Tile from '@/components/Tile'
import { jsonLd, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from '@/lib/seo'
import '@/components/dashboard/dashboard.css'

// Los mismos título y descripción que el layout raíz (sin la plantilla «%s | HubGames»).
export const metadata: Metadata = {
    title: { absolute: SITE_TITLE },
    description: SITE_DESCRIPTION,
    alternates: { canonical: '/' },
}

/** Datos estructurados de la portada: el sitio (WebSite) y quién lo hace (Organization). */
const HOME_LD = jsonLd({
    '@graph': [
        { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: SITE_NAME, description: SITE_DESCRIPTION, inLanguage: 'es' },
        { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, url: `${SITE_URL}/`, name: SITE_NAME, logo: `${SITE_URL}/icons/apple-touch-icon.png` },
    ],
})

// Depende de la sesión: nunca se genera estática.
export const dynamic = 'force-dynamic'

/** Año de ejemplo para la portada: siempre el mismo dibujo (generador con semilla fija), más jugado los fines de semana. */
function sampleHeatmap(today: string) {
    let seed = 11
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
    const start = Date.parse(`${heatmapStart(today)}T00:00:00Z`)
    const playtime = Array.from({ length: 53 * 7 }, (_, i) => {
        const weekend = i % 7 >= 5
        const minutes = rnd() < (weekend ? 0.3 : 0.5) ? 0 : Math.round(rnd() * (weekend ? 330 : 190))
        return { date: new Date(start + i * 86400_000).toISOString().slice(0, 10), minutes }
    })
    return buildHeatmap({ today, playtime, unlocks: [] })
}

function Landing() {
    return (
        <div className="land">
            <div className="land-top">
                <div className="land-hero hg-enter">
                    <h1 className="page-title">Tu biblioteca de Steam, tus logros y a qué jugar hoy</h1>
                    <p className="page-subtitle">
                        Conecta Steam y HubGames pone cada juego en su lista, te dice qué logros te faltan y cuándo algo de tu wishlist está más barato
                        que nunca.
                    </p>
                    <div className="land-actions">
                        <Button asChild>
                            <Link href="/login">
                                <LogIn aria-hidden /> Entrar
                            </Link>
                        </Button>
                        <Button variant="secondary" asChild>
                            <Link href="/judi">
                                <Gamepad2 aria-hidden /> Jugar a JUDI
                            </Link>
                        </Button>
                        <Button variant="ghost" asChild>
                            <Link href="/ranking">
                                <Trophy aria-hidden /> Ver el ranking
                            </Link>
                        </Button>
                    </div>
                </div>
                <LandingPreview />
            </div>
            <figure className="land-heat hg-enter" style={{ '--i': 6 } as React.CSSProperties}>
                <ActivityHeatmap
                    preview
                    map={sampleHeatmap(madridDate(new Date()))}
                    header={
                        <dl className="hg-tiles dash-tiles">
                            <Tile icon={<Clock aria-hidden />} tone="st-jugando" label="Horas este año">
                                <dd className="hg-tile__value">312 h</dd>
                            </Tile>
                            <Tile icon={<Award aria-hidden />} tone="st-sin_final" label="Logros">
                                <dd className="hg-tile__value">1284</dd>
                            </Tile>
                            <Tile icon={<Flag aria-hidden />} tone="st-completado" label="Completados">
                                <dd className="hg-tile__value">18</dd>
                            </Tile>
                            <Tile icon={<Star aria-hidden />} tone="sc-good" label="Nota media">
                                <dd className="hg-tile__value hg-tile__value--tinted">8,2</dd>
                            </Tile>
                        </dl>
                    }
                />
                <figcaption>Tu año de un vistazo: cada casilla es un día, más intensa cuanto más juegas.</figcaption>
            </figure>
        </div>
    )
}

/** Inicio: el dashboard (#29) con sesión; sin ella, la portada. Se pinta en el servidor. */
export default async function HomePage() {
    const supabase = await createServerClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user)
        return (
            <>
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: HOME_LD }} />
                <Landing />
            </>
        )

    const now = new Date()
    const data = await loadDashboard(supabase, user.id, now)
    // La semilla de "Sorpréndeme" (#30) cambia en cada visita.
    return <Dashboard data={data} now={now.getTime()} seed={now.getTime() % 1_000_000} />
}

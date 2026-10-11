import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'

export default function SiteFooter() {
    return (
        <footer className="site-footer">
            <Link href="/" scroll={false} style={{ textDecoration: 'none' }} aria-label="HubGames, inicio">
                <Logo size={22} animated={false} />
            </Link>
            <span>Un juego nuevo cada día a las 00:00 (hora de Madrid).</span>
            <a href="https://github.com/Diego-Mardomingo/HubGames" target="_blank" rel="noreferrer">
                GitHub
            </a>
        </footer>
    )
}

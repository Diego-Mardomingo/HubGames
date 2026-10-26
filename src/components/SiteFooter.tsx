import Link from 'next/link'
import { ExternalLink, Gamepad2 } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'

/** Pie de página: qué es HubGames, JUDI y de dónde salen los datos (IsThereAnyDeal pide citar la fuente con enlace). */
export default function SiteFooter() {
    return (
        <footer className="site-footer">
            <Link href="/" scroll={false} className="site-footer__brand" aria-label="HubGames, inicio">
                <Logo size={17} animated={false} />
            </Link>
            <div className="site-footer__lines">
                <p className="site-footer__lead">Tu biblioteca de Steam y tus logros, en un sitio.</p>
                <p>
                    <Gamepad2 aria-hidden /> JUDI: un juego nuevo cada día a las 00:00 (hora de Madrid).
                </p>
                <p>
                    Datos de{' '}
                    <a href="https://store.steampowered.com/" target="_blank" rel="noreferrer">
                        Steam
                    </a>
                    , precios de{' '}
                    <a href="https://isthereanydeal.com/" target="_blank" rel="noreferrer">
                        IsThereAnyDeal
                    </a>{' '}
                    y duraciones de{' '}
                    <a href="https://howlongtobeat.com/" target="_blank" rel="noreferrer">
                        HowLongToBeat
                    </a>
                    .
                </p>
            </div>
            <a className="site-footer__link" href="https://github.com/Diego-Mardomingo/HubGames" target="_blank" rel="noreferrer">
                GitHub <ExternalLink aria-hidden />
                <span className="sr-only">(se abre en otra pestaña)</span>
            </a>
        </footer>
    )
}

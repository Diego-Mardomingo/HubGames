export default function Footer() {
    return (
        <footer className="footer">
            <div className="content">
                {new Date().getFullYear()} HubGames · Hecho con ❤️ por Diego ·{' '}
                <a href="https://github.com/Diego-Mardomingo" target="_blank" rel="noopener noreferrer">
                    GitHub
                </a>
            </div>
        </footer>
    )
}

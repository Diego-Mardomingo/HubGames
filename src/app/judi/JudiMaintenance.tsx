import Link from 'next/link'
import './judi.css'

export default function JudiMaintenance() {
    return (
        <div className="judi-container">
            <div
                className="cuerpo"
                style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 215, 0, 0.25)',
                    borderRadius: '20px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
                    maxWidth: '520px',
                    width: '100%',
                    margin: '2rem auto',
                    padding: '2.5rem 1.75rem',
                    textAlign: 'center',
                }}
            >
                <div className="titulo" style={{ marginBottom: '1.25rem' }}>
                    <h1 style={{ marginBottom: '0.35rem' }}>JUDI</h1>
                    <h3 style={{ opacity: 0.85 }}>En mantenimiento</h3>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.65, marginBottom: '1.5rem', fontSize: '1.05rem' }}>
                    Estamos mejorando el Juego del día. Volveremos en breve; mientras tanto puedes explorar el resto de HubGames.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
                    <Link href="/" className="btn-primary" style={{ padding: '0.65rem 1.35rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className="fa-solid fa-house" aria-hidden />
                        Ir al inicio
                    </Link>
                    <Link href="/login" className="btn-secondary" style={{ padding: '0.65rem 1.35rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className="fa-solid fa-right-to-bracket" aria-hidden />
                        Iniciar sesión
                    </Link>
                </div>
            </div>
        </div>
    )
}

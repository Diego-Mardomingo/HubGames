import { CalendarDays, CircleCheck, EyeOff, Lock, Mail, Shield, TriangleAlert, Unlink } from 'lucide-react'
import { STEAM_STATE_META, steamState, type SteamState } from '@/lib/profile'
import type { SteamLink } from './SteamSetting'
import { enter } from './Section'

const STATE_ICON: Record<SteamState, typeof CircleCheck> = {
    ok: CircleCheck,
    privado: Lock,
    detalles: EyeOff,
    desconocida: TriangleAlert,
    none: Unlink,
}

/** Tarjeta de usuario: quién eres (avatar, nombre, Admin, email, desde cuándo) y tu cuenta de Steam con su estado. Sin cifras de juegos. */
export default function ProfileCard({
    name,
    email,
    isAdmin,
    since,
    link,
    steamLoaded,
}: {
    name: string
    email: string
    isAdmin: boolean
    since: string | null
    link: SteamLink | null
    steamLoaded: boolean
}) {
    const state = steamState(link)
    const meta = STEAM_STATE_META[state]
    const StateIcon = STATE_ICON[state]
    const avatar = link?.avatar

    return (
        <header className="pf-card hg-enter" style={enter(0)}>
            <span className="pf-avatar" aria-hidden>
                {name[0]?.toUpperCase() ?? 'U'}
                {/* eslint-disable-next-line @next/next/no-img-element -- avatar de Steam (avatars.steamstatic.com), 184 px */}
                {avatar && <img src={avatar} alt="" width={80} height={80} onError={(e) => e.currentTarget.remove()} />}
            </span>
            <div className="pf-who">
                <h1 className="page-title pf-who__name">
                    <span key={name} className="pf-swap">
                        {name}
                    </span>
                    {isAdmin && (
                        <span className="hg-chip hg-tint dash-warn pf-admin-chip">
                            <Shield aria-hidden /> Admin
                        </span>
                    )}
                </h1>
                <p className="pf-who__meta">
                    <span>
                        <Mail aria-hidden />
                        {email}
                    </span>
                    {since && (
                        <span>
                            <CalendarDays aria-hidden />
                            En HubGames desde {since}
                        </span>
                    )}
                </p>
            </div>
            {steamLoaded && (
                <div className={`pf-steamid ${meta.tone}`}>
                    <span className="pf-steamid__av" aria-hidden>
                        {link ? (link.persona_name ?? link.steamid)[0]?.toUpperCase() : <Unlink />}
                        {/* eslint-disable-next-line @next/next/no-img-element -- avatar de Steam */}
                        {avatar && <img src={avatar} alt="" width={44} height={44} onError={(e) => e.currentTarget.remove()} />}
                    </span>
                    <span className="pf-steamid__text">
                        <span className="pf-steamid__label">{link ? 'Cuenta de Steam' : 'Steam'}</span>
                        <span className="pf-steamid__name">{link ? (link.persona_name ?? link.steamid) : 'Sin cuenta vinculada'}</span>
                        <span key={state} className={`pf-steamid__state pf-ink ${meta.tone}`}>
                            <StateIcon aria-hidden />
                            {meta.label}
                        </span>
                    </span>
                </div>
            )}
        </header>
    )
}

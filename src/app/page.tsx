import JudiClient from '@/app/judi/JudiClient'
import JudiMaintenance from '@/app/judi/JudiMaintenance'

export default function HomePage() {
    if (process.env.NEXT_PUBLIC_JUDI_MAINTENANCE === 'true') {
        return <JudiMaintenance />
    }
    return <JudiClient />
}

import JudiClient from './JudiClient'
import JudiMaintenance from './JudiMaintenance'

export default function JUDIPage() {
    if (process.env.NEXT_PUBLIC_JUDI_MAINTENANCE === 'true') {
        return <JudiMaintenance />
    }
    return <JudiClient />
}

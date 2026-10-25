// Formatos sin dependencias (se pueden usar en los tests sin crear el cliente de Supabase).

/** Minutos → "45 min", "2,5 h", "12 h". */
export function formatHours(minutes: number): string {
    if (minutes === 0) return '0 h'
    if (minutes < 60) return `${minutes} min`
    const hours = minutes / 60
    return `${hours < 10 ? hours.toFixed(1).replace('.', ',') : Math.round(hours)} h`
}

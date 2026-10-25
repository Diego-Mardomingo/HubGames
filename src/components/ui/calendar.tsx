import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import 'react-day-picker/dist/style.css'

type CalendarProps = React.ComponentProps<typeof DayPicker>

/** Calendario (react-day-picker 9) con las clases `rdp-*` de la librería tematizadas en styles/ui.css (`.hg-cal`). */
function Calendar({ className, showOutsideDays = true, ...props }: CalendarProps) {
    return <DayPicker showOutsideDays={showOutsideDays} locale={es} className={cn('hg-cal', className)} {...props} />
}

Calendar.displayName = 'Calendar'

export { Calendar }

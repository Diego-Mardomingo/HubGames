import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import 'react-day-picker/dist/style.css'

type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            locale={es}
            className={cn('p-2', className)}
            classNames={{
                months: 'flex flex-col',
                month: 'space-y-2',
                caption: 'flex justify-center pt-1 relative items-center text-sm font-semibold text-[var(--foreground)]',
                table: 'w-full border-collapse space-y-1',
                head_row: 'flex',
                head_cell: 'text-[var(--muted)] rounded-[var(--radius-sm)] w-9 font-medium text-xs',
                row: 'flex w-full mt-1',
                cell: 'h-9 w-9 text-center text-sm p-0 relative',
                day: 'h-9 w-9 p-0 font-normal rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)]',
                day_selected: 'bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]',
                day_today: 'border border-[var(--primary)]',
                day_outside: 'text-[var(--muted)] opacity-50',
                day_disabled: 'text-[var(--muted)] opacity-40',
                ...classNames,
            }}
            {...props}
        />
    )
}

Calendar.displayName = 'Calendar'

export { Calendar }

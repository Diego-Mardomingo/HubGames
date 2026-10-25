import { CalendarDays } from 'lucide-react'
import { format } from 'date-fns'
import { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DateRangePickerProps {
    value: DateRange | undefined
    onChange: (range: DateRange | undefined) => void
    className?: string
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
    return (
        <div className={cn('hg-daterange', className)}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="secondary" className={cn('hg-daterange__trigger', !value?.from && 'is-empty')}>
                        <CalendarDays size={16} data-icon="inline-start" aria-hidden />
                        {value?.from ? (
                            value.to ? (
                                <>
                                    {format(value.from, 'dd/MM/yyyy')} – {format(value.to, 'dd/MM/yyyy')}
                                </>
                            ) : (
                                format(value.from, 'dd/MM/yyyy')
                            )
                        ) : (
                            <span>Elegir un rango de fechas</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="hg-popover--auto" align="start">
                    <Calendar autoFocus mode="range" defaultMonth={value?.from} selected={value} onSelect={onChange} numberOfMonths={1} />
                </PopoverContent>
            </Popover>
        </div>
    )
}

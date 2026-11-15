import BurningCalendar, { type SelectedMonth } from './BurningCalendar'
import type { CalendarResponse } from '../types'

interface Props {
  data: CalendarResponse
  selected: SelectedMonth | null
  onSelect: (s: SelectedMonth | null) => void
}

/** Same grid as the burning calendar, coloured by percent of median on a PuOr ramp centred on 0. */
export default function AnomalyCalendar(props: Props) {
  return <BurningCalendar {...props} mode="anomalies" />
}

import ValidationFunction from './validationFunction'
import { parseUkDate } from '../../../utils/utils'

export default function futureDate(errorMessage: string): ValidationFunction {
  return (value: string | string[] | number | undefined) => {
    if (typeof value !== 'string') {
      return errorMessage
    }

    const parsedDateString = parseUkDate(value)
    const today = parseUkDate(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date()),
    )

    if (!parsedDateString || parsedDateString <= today) {
      return errorMessage
    }

    return null
  }
}

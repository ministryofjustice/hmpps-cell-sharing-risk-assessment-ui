import ValidationFunction from './validationFunction'
import { validateUkDate } from '../../../utils/utils'

type ErrorMessages = {
  WRONG_FORMAT: string
  INCOMPLETE: string
  NON_EXISTENT: string
}

export default function validDate(errorMessages: ErrorMessages): ValidationFunction {
  return (value: string | string[] | number | undefined) => {
    if (typeof value !== 'string') {
      return errorMessages.WRONG_FORMAT
    }

    const errorType = validateUkDate(value)
    if (errorType) {
      return errorMessages[errorType]
    }

    return null
  }
}

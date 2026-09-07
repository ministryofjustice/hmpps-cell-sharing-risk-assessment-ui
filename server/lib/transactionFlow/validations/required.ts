export default function required(errorMessage: string) {
  return (value: string | string[] | number | undefined) => {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      return errorMessage
    }

    return null
  }
}

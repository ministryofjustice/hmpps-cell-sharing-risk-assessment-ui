export const yesNoValue = (val: unknown): string | unknown => {
  if (val === false) {
    return 'No'
  }

  return val === true ? 'Yes' : val
}

export default yesNoValue

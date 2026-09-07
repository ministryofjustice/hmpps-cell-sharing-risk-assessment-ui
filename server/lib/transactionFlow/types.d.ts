declare type FormValues = Record<string, string | string[] | number | boolean>

declare type ValidationFunction = (value: string | string[] | number | undefined) => string

declare type Section = {
  title: string
  steps: import('./step').default[]
}

declare type CheckboxItem = {
  text: string
  hint?: { text: string } | { html: string }
  value: string
  conditional?: import('./questionTypes/base').default
  removeIf?: (assessment: import('../../data/csraApiTypes').CsraAssessment) => boolean
}

declare type PickByType<T, Value> = {
  [P in keyof T as T[P] extends Value | undefined ? P : never]: T[P]
}

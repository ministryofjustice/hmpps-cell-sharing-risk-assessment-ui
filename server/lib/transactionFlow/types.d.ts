declare type FormValues = Record<string, string | string[] | number | boolean>

declare type ValidationFunction = (value: string | string[] | number | undefined) => string

declare type Section = {
  title: string
  steps: import('./step').default[]
  // An additional completion requirement; the applicable steps must still be answered.
  isCompleteForSection?: (assessmentAnswers: import('../../data/csraApiTypes').CsraAssessmentStageAnswers) => boolean
}

declare type CheckboxItem = {
  text: string
  hint?: { text: string } | { html: string }
  value: string
  conditional?: import('./questionTypes/base').default
  removeIf?: (assessmentAnswers: import('../../data/csraApiTypes').CsraAssessmentStageAnswers) => boolean
}

declare type PickByType<T, Value> = {
  [P in keyof T as T[P] extends Value | undefined ? P : never]: T[P]
}

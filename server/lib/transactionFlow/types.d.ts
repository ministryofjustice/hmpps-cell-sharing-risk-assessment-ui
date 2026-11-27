declare type FormValues = Record<string, string | string[] | number | boolean>

declare type ValidationFunction = (value: string | string[] | number | undefined) => string

declare type Section<AnswersObject extends import('./baseAnswersObject').default> = {
  title: string
  steps: import('./step').default<AnswersObject>[]
  // An additional completion requirement; the applicable steps must still be answered.
  isCompleteForSection?: (assessmentAnswers: AnswersObject) => boolean
}

declare type CheckboxItem<AnswersObject extends object> = {
  text: string
  hint?: { text: string } | { html: string }
  value: string
  conditional?: import('./questionTypes/base').default<AnswersObject>
  removeIf?: (assessmentAnswers: AnswersObject) => boolean
}

declare type PickByType<T, Value> = {
  [P in keyof T as T[P] extends Value | undefined ? P : never]: T[P]
}

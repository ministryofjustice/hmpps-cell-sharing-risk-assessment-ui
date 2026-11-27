import BaseAnswersObject from './baseAnswersObject'
import Step from './step'
import CheckboxQuestion from './questionTypes/checkbox'
import RadioQuestion from './questionTypes/radio'
import { QuestionContext } from './questionTypes/base'

type FieldValue = string | string[] | number | undefined

export function validateStep<AnswersObject extends BaseAnswersObject>(
  step: Step<AnswersObject>,
  body: Record<string, FieldValue>,
  initialValues: FormValues,
  context?: QuestionContext<AnswersObject>,
  validateRadioOptions = false,
) {
  const newValues: Record<string, FieldValue> = {}
  const errors: Record<string, { text: string }> = {}
  const values = { ...initialValues }

  const firstError = (validations: ValidationFunction[], value: FieldValue) => {
    for (const validate of validations ?? []) {
      const error = validate(value)
      if (error) return error
    }
    return undefined
  }

  step.questions.forEach(question => {
    const value = body[question.id]
    newValues[question.id] = value
    values[question.id] = value
    const error = firstError(question.validations(context), value)
    if (error) errors[question.id] = { text: error }

    if (question instanceof CheckboxQuestion || question instanceof RadioQuestion) {
      if (
        validateRadioOptions &&
        question instanceof RadioQuestion &&
        !error &&
        !question.items.some(item => item.value === value)
      ) {
        errors[question.id] = { text: 'Select a valid option' }
      }
      question.items.forEach(item => {
        const selected = Array.isArray(value) ? value.includes(item.value) : value === item.value
        if (selected && item.conditional) {
          const conditionalValue = body[item.conditional.id]
          newValues[item.conditional.id] = conditionalValue
          values[item.conditional.id] = conditionalValue
          const conditionalError = firstError(item.conditional.validations(), conditionalValue)
          if (conditionalError) errors[item.conditional.id] = { text: conditionalError }
        }
      })
    }
  })

  return { newValues, errors, values }
}

export function eraseRemovedSteps<AnswersObject extends BaseAnswersObject>(
  steps: Step<AnswersObject>[],
  answers: AnswersObject,
): AnswersObject {
  return steps.reduce((current, step) => (step.removeIf(current) ? step.eraseAnswers(current) : current), answers)
}

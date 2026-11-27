import Question from './base'
import RadioQuestion, { RadioQuestionOptions } from './radio'
import BaseAnswersObject from '../baseAnswersObject'

export type YesNoQuestionOptions = RadioQuestionOptions

export default class YesNoQuestion<AnswersObject extends BaseAnswersObject> extends RadioQuestion<
  AnswersObject,
  boolean
> {
  constructor(
    question: string | null,
    id: keyof PickByType<AnswersObject, boolean> & string,
    options: YesNoQuestionOptions = {},
    items: { text: string; value: string; conditional?: Question<AnswersObject> }[] = [
      { text: 'Yes', value: 'YES' },
      { text: 'No', value: 'NO' },
    ],
  ) {
    super(question, id, items, options)
  }

  override getFormValues(assessmentAnswers: AnswersObject): FormValues {
    let values: FormValues = {}

    if (assessmentAnswers[this.id] === false) {
      values[this.id] = 'NO'

      const noConditional = this.items.find(item => item.value === 'NO' && item.conditional)
      if (noConditional) {
        values = { ...values, ...noConditional.conditional.getFormValues(assessmentAnswers) }
      }
    } else if (assessmentAnswers[this.id] === true) {
      values[this.id] = 'YES'

      const yesConditional = this.items.find(item => item.value === 'YES' && item.conditional)
      if (yesConditional) {
        values = { ...values, ...yesConditional.conditional.getFormValues(assessmentAnswers) }
      }
    }

    return values
  }

  override isAnswered(assessmentAnswers: AnswersObject): boolean {
    const value = assessmentAnswers[this.id]

    if (value === true) {
      return (
        this.items.find(item => item.value === 'YES' && item.conditional)?.conditional?.isAnswered(assessmentAnswers) ??
        true
      )
    }

    if (value === false) {
      return (
        this.items.find(item => item.value === 'NO' && item.conditional)?.conditional?.isAnswered(assessmentAnswers) ??
        true
      )
    }

    return false
  }

  override mutateAssessmentAnswers(assessmentAnswers: AnswersObject, formValues: FormValues): AnswersObject {
    let mutatedAssessmentAnswers = { ...assessmentAnswers, [this.id]: formValues[this.id] === 'YES' }

    this.items
      .filter(i => i.conditional)
      .forEach(item => {
        if (formValues[this.id] === item.value) {
          mutatedAssessmentAnswers = item.conditional.mutateAssessmentAnswers(mutatedAssessmentAnswers, formValues)
        } else if (item.conditional.id in mutatedAssessmentAnswers) {
          mutatedAssessmentAnswers[item.conditional.id as keyof PickByType<AnswersObject, string>] = null
        }
      })

    return mutatedAssessmentAnswers
  }
}

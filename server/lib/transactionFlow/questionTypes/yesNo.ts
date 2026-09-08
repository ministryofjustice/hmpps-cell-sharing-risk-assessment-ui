import Question from './base'
import { CsraAssessment, CsraAssessmentStageAnswers } from '../../../data/csraApiTypes'
import required from '../validations/required'
import FeComponentsService from '../../../services/feComponentsService'

export default class YesNoQuestion extends Question {
  constructor(
    question: string | null,
    public override id: keyof PickByType<CsraAssessmentStageAnswers, boolean>,
    public hint?: string,
    public items: { text: string; value: string; conditional?: Question }[] = [
      { text: 'Yes', value: 'YES' },
      { text: 'No', value: 'NO' },
    ],
  ) {
    super(question, id, 'govukRadios')
  }

  override componentAttributes(
    validationErrors: Record<string, { text: string }> | undefined,
    values: FormValues | undefined,
    assessmentAnswers: CsraAssessmentStageAnswers,
  ): object {
    return {
      id: this.id,
      name: this.id,
      fieldset: {
        legend: {
          text: this.question,
          classes: 'govuk-fieldset__legend--m',
        },
      },
      ...(this.hint ? { hint: { text: this.hint } } : {}),
      items: this.items
        .map(item => {
          return {
            ...item,
            conditional: item.conditional
              ? {
                  html: FeComponentsService.getComponent(
                    item.conditional.component,
                    item.conditional.componentAttributes(validationErrors, values, assessmentAnswers),
                  ),
                }
              : undefined,
          }
        })
        .filter(i => i),
      value: values[this.id],
      errorMessage: validationErrors ? validationErrors[this.id]?.text : undefined,
    }
  }

  override validations(): ValidationFunction[] {
    return [required('TODO: select one')]
  }

  override getFormValues(assessmentAnswers: CsraAssessmentStageAnswers): FormValues {
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

  override isAnswered(assessmentAnswers: CsraAssessmentStageAnswers): boolean {
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

  override mutateAssessmentAnswers(
    assessmentAnswers: CsraAssessmentStageAnswers,
    formValues: FormValues,
  ): CsraAssessmentStageAnswers {
    let mutatedAnswers = { ...assessmentAnswers, [this.id]: formValues[this.id] === 'YES' }

    this.items
      .filter(i => i.conditional)
      .forEach(item => {
        if (formValues[this.id] === item.value) {
          mutatedAnswers = item.conditional.mutateAssessmentAnswers(mutatedAnswers, formValues)
        } else if (item.conditional.id in mutatedAnswers) {
          mutatedAnswers[item.conditional.id as keyof PickByType<CsraAssessmentStageAnswers, string>] = null
        }
      })

    return mutatedAnswers
  }
}

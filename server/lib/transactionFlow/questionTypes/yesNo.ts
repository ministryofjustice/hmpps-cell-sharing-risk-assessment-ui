import Question from './base'
import { CsraAssessment } from '../../../data/csraApiTypes'
import required from '../validations/required'

export default class YesNoQuestion extends Question {
  constructor(
    question: string,
    public override id: keyof PickByType<CsraAssessment, boolean>,
  ) {
    super(question, id, 'govukRadios')
  }

  override componentAttributes(
    validationErrors: Record<string, { text: string }> | undefined,
    values: FormValues | undefined,
    _assessment: CsraAssessment,
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
      items: [
        { text: 'Yes', value: 'YES' },
        { text: 'No', value: 'NO' },
      ],
      value: values[this.id],
      errorMessage: validationErrors ? validationErrors[this.id]?.text : undefined,
    }
  }

  override validations(): ValidationFunction[] {
    return [required('TODO: select one')]
  }

  override getFormValues(assessment: CsraAssessment): FormValues {
    if (assessment[this.id] === false) {
      return { [this.id]: 'NO' }
    }

    return { [this.id]: assessment[this.id] === true ? 'YES' : undefined }
  }

  override isComplete(assessment: CsraAssessment): boolean {
    return assessment[this.id] !== undefined
  }

  override mutateAssessment(assessment: CsraAssessment, formValues: FormValues): CsraAssessment {
    return { ...assessment, [this.id]: formValues[this.id] === 'YES' }
  }
}

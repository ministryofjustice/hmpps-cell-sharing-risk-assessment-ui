import Question from './base'
import { CsraAssessment } from '../../../data/csraApiTypes'
import required from '../validations/required'

export default class TextAreaQuestion extends Question {
  constructor(
    question: string,
    public override id: keyof PickByType<CsraAssessment, string>,
  ) {
    super(question, id, 'govukTextarea')
  }

  override componentAttributes(
    validationErrors: Record<string, { text: string }> | undefined,
    values: Record<string, unknown> | undefined,
    _assessment: CsraAssessment,
  ): object {
    return {
      id: this.id,
      name: this.id,
      label: {
        text: this.question,
        classes: 'govuk-fieldset__legend--m',
      },
      value: values[this.id],
      errorMessage: validationErrors ? validationErrors[this.id]?.text : undefined,
    }
  }

  override validations(): ValidationFunction[] {
    return [required('TODO: enter a reason')]
  }

  override getFormValues(assessment: CsraAssessment): FormValues {
    return { [this.id]: assessment[this.id] }
  }

  override isComplete(assessment: CsraAssessment): boolean {
    return !!assessment[this.id]
  }

  override mutateAssessment(assessment: CsraAssessment, formValues: FormValues): CsraAssessment {
    return { ...assessment, [this.id]: formValues[this.id] }
  }
}

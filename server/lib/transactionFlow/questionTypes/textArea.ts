import Question from './base'
import { CsraAssessmentStageAnswers } from '../../../data/csraApiTypes'
import required from '../validations/required'

export default class TextAreaQuestion extends Question {
  constructor(
    question: string,
    public override id: keyof PickByType<CsraAssessmentStageAnswers, string>,
  ) {
    super(question, id, 'govukTextarea')
  }

  override componentAttributes(
    validationErrors: Record<string, { text: string }> | undefined,
    values: Record<string, unknown> | undefined,
    _assessmentAnswers: CsraAssessmentStageAnswers,
  ): object {
    return {
      id: this.id,
      name: this.id,
      label: {
        text: this.question,
        classes: 'govuk-fieldset__legend--s',
      },
      value: values[this.id],
      errorMessage: validationErrors ? validationErrors[this.id]?.text : undefined,
    }
  }

  override validations(): ValidationFunction[] {
    return [required('TODO: enter a reason')]
  }

  override getFormValues(assessmentAnswers: CsraAssessmentStageAnswers): FormValues {
    return { [this.id]: assessmentAnswers[this.id] }
  }

  override isAnswered(assessmentAnswers: CsraAssessmentStageAnswers): boolean {
    return !!assessmentAnswers[this.id]
  }

  override mutateAssessmentAnswers(
    assessmentAnswers: CsraAssessmentStageAnswers,
    formValues: FormValues,
  ): CsraAssessmentStageAnswers {
    return { ...assessmentAnswers, [this.id]: formValues[this.id] }
  }
}

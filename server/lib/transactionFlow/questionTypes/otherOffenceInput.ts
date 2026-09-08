import { CsraAssessmentStageAnswers, OffenceType } from '../../../data/csraApiTypes'
import Question from './base'
import required from '../validations/required'

export default class OtherOffenceInputQuestion extends Question {
  constructor(
    question: string,
    id: string,
    public readonly offenceType: OffenceType,
  ) {
    super(question, id, 'govukInput')
  }

  override componentAttributes(
    validationErrors: Record<string, { text: string }> | undefined,
    values: FormValues | undefined,
    _assessmentAnswers: CsraAssessmentStageAnswers,
  ): object {
    return {
      id: this.id,
      name: this.id,
      label: {
        text: this.question,
      },
      classes: 'govuk-input--width-10',
      value: values[this.id],
      errorMessage: validationErrors ? validationErrors[this.id]?.text : undefined,
    }
  }

  override validations(): ValidationFunction[] {
    return [required('TODO: enter a reason')]
  }

  override mutateAssessmentAnswers(
    assessmentAnswers: CsraAssessmentStageAnswers,
    formValues: FormValues,
  ): CsraAssessmentStageAnswers {
    return {
      ...assessmentAnswers,
      offenceEvidence: assessmentAnswers.offenceEvidence.map(e => {
        if (e.offence !== this.offenceType) {
          return e
        }

        return { ...e, otherSourceDetail: formValues[this.id] as string }
      }),
    }
  }

  private getEvidenceData(assessmentAnswers: CsraAssessmentStageAnswers) {
    return assessmentAnswers.offenceEvidence?.find(e => e.offence === this.offenceType)
  }

  override getFormValues(assessmentAnswers: CsraAssessmentStageAnswers): FormValues {
    return { [this.id]: this.getEvidenceData(assessmentAnswers)?.otherSourceDetail || '' }
  }

  override isAnswered(assessmentAnswers: CsraAssessmentStageAnswers): boolean {
    return !!this.getEvidenceData(assessmentAnswers)?.otherSourceDetail
  }
}

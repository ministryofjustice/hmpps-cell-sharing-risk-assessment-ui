import TextAreaQuestion from './textArea'
import { CsraAssessmentStageAnswers, OffenceType } from '../../../data/csraApiTypes'

export default class OffenceEvidenceDetailsQuestion extends TextAreaQuestion {
  constructor(public offenceType: OffenceType) {
    super('Provide details of the evidence', 'likelyToHarmCellmateDetail')
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

        return { ...e, details: formValues[this.id] as string }
      }),
    }
  }

  private getEvidenceData(assessmentAnswers: CsraAssessmentStageAnswers) {
    return assessmentAnswers.offenceEvidence?.find(e => e.offence === this.offenceType)
  }

  override getFormValues(assessmentAnswers: CsraAssessmentStageAnswers): FormValues {
    return { [this.id]: this.getEvidenceData(assessmentAnswers)?.details || '' }
  }

  override isAnswered(assessmentAnswers: CsraAssessmentStageAnswers): boolean {
    return !!this.getEvidenceData(assessmentAnswers)?.details
  }
}

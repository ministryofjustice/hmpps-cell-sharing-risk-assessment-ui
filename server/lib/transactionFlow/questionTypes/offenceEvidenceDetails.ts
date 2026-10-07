import TextAreaQuestion from './textArea'
import { CsraAssessmentStageAnswers, OffenceType } from '../../../data/csraApiTypes'
import required from '../validations/required'

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
      offenceEvidence: (assessmentAnswers.offenceEvidence ?? []).map(e => {
        if (e.offence !== this.offenceType) {
          return e
        }

        return { ...e, details: formValues[this.id] as string }
      }),
    }
  }

  override validations(): ValidationFunction[] {
    return [required('Enter details of the evidence')]
  }

  override eraseAnswers(assessmentAnswers: CsraAssessmentStageAnswers): CsraAssessmentStageAnswers {
    // Erasure is handled by OffenceEvidenceStep, so we don't need to do anything here
    return assessmentAnswers
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

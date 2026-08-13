import TextAreaQuestion from './textArea'
import { CsraAssessment, OffenceType } from '../../../data/csraApiTypes'

export default class OffenceEvidenceDetailsQuestion extends TextAreaQuestion {
  constructor(public offenceType: OffenceType) {
    super('Provide details of the evidence', 'assessmentComment')
  }

  override mutateAssessment(assessment: CsraAssessment, formValues: FormValues): CsraAssessment {
    return {
      ...assessment,
      offenceEvidence: assessment.offenceEvidence.map(e => {
        if (e.offence !== this.offenceType) {
          return e
        }

        return { ...e, details: formValues[this.id] as string }
      }),
    }
  }

  private getEvidenceData(assessment: CsraAssessment) {
    return assessment.offenceEvidence?.find(e => e.offence === this.offenceType)
  }

  override getFormValues(assessment: CsraAssessment): FormValues {
    return { [this.id]: this.getEvidenceData(assessment)?.details || '' }
  }

  override isComplete(assessment: CsraAssessment): boolean {
    return !!this.getEvidenceData(assessment)?.details
  }
}

import Step from './step'
import YesNoQuestion from './questionTypes/yesNo'
import { CsraAssessment, OffenceType } from '../../data/csraApiTypes'
import OffenceEvidenceSourceCheckboxQuestion from './questionTypes/offenceEvidenceSourceCheckbox'
import OffenceEvidenceDetailsQuestion from './questionTypes/offenceEvidenceDetails'

export default class OffenceEvidenceStep extends Step {
  constructor(
    public readonly question: YesNoQuestion,
    public readonly offenceType: OffenceType,
  ) {
    super({
      questions: [
        new OffenceEvidenceSourceCheckboxQuestion(question, offenceType),
        new OffenceEvidenceDetailsQuestion(offenceType),
      ],
    })
  }

  override removeIf(assessment: CsraAssessment): boolean {
    return !assessment[this.question.id]
  }

  private getEvidenceData(assessment: CsraAssessment) {
    return assessment.offenceEvidence?.find(e => e.offence === this.offenceType)
  }

  override mutateAssessment(assessment: CsraAssessment, formValues: FormValues): CsraAssessment {
    const mutatedAssessment = {
      ...assessment,
      offenceEvidence: assessment.offenceEvidence ? assessment.offenceEvidence : [],
    }

    if (!this.getEvidenceData(mutatedAssessment)) {
      mutatedAssessment.offenceEvidence.push({ offence: this.offenceType, sources: [], details: '' })
    }

    return super.mutateAssessment(mutatedAssessment, formValues)
  }
}

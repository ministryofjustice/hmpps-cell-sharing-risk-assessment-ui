import Step from './step'
import YesNoQuestion from './questionTypes/yesNo'
import { CsraAssessmentStageAnswers, OffenceType } from '../../data/csraApiTypes'
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

  override removeIf(assessmentAnswers: CsraAssessmentStageAnswers): boolean {
    return !assessmentAnswers[this.question.id]
  }

  private getEvidenceData(assessmentAnswers: CsraAssessmentStageAnswers) {
    return assessmentAnswers.offenceEvidence?.find(e => e.offence === this.offenceType)
  }

  override mutateAssessmentAnswers(
    assessmentAnswers: CsraAssessmentStageAnswers,
    formValues: FormValues,
  ): CsraAssessmentStageAnswers {
    const mutatedAssessmentAnswers = {
      ...assessmentAnswers,
      offenceEvidence: assessmentAnswers.offenceEvidence ? assessmentAnswers.offenceEvidence : [],
    }

    if (!this.getEvidenceData(mutatedAssessmentAnswers)) {
      mutatedAssessmentAnswers.offenceEvidence.push({ offence: this.offenceType, sources: [], details: '' })
    }

    return super.mutateAssessmentAnswers(mutatedAssessmentAnswers, formValues)
  }
}

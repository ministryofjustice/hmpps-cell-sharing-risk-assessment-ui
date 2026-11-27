import YesNoQuestion from './questionTypes/yesNo'
import { CsraAssessmentStageAnswers, OffenceType } from '../../data/csraApiTypes'
import Step from './step'
import OffenceEvidenceStep from './offenceEvidenceStep'

export default class YesNoOffenceSteps {
  constructor(
    public readonly questions: { question: YesNoQuestion<CsraAssessmentStageAnswers>; offenceType: OffenceType }[],
  ) {}

  getSteps() {
    return [
      new Step({ questions: this.questions.map(q => q.question) }),
      ...this.questions.map(({ question, offenceType }) => new OffenceEvidenceStep(question, offenceType)),
    ]
  }
}

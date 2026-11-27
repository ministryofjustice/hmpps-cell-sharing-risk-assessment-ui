import Step from './step'
import { CsraAssessmentStageAnswers } from '../../data/csraApiTypes'

export default class InformationStep extends Step<CsraAssessmentStageAnswers> {
  constructor(options: Pick<Step<CsraAssessmentStageAnswers>, 'title' | 'bodyHtml'>) {
    super({ ...options, questions: [] })
  }
}

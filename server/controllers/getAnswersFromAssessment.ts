import { CsraAssessment, CsraAssessmentStageAnswers } from '../data/csraApiTypes'
import getAssessmentContext from '../lib/transactionFlow/assessmentContext'

export default function getAnswersFromAssessment(assessment: CsraAssessment): CsraAssessmentStageAnswers {
  return getAssessmentContext(assessment).answers
}

import { CsraAssessment } from '../../data/csraApiTypes'
import Question from './questionTypes/base'

export default class Step {
  title?: string

  bodyHtml?: string

  questions: Question[]

  constructor({ questions, title, bodyHtml }: Pick<Step, 'questions' | 'title' | 'bodyHtml'>) {
    this.questions = questions
    this.title = title
    this.bodyHtml = bodyHtml
  }

  removeIf(_assessment: CsraAssessment) {
    return false
  }

  isComplete(assessment: CsraAssessment) {
    return this.questions.every(q => q.isComplete(assessment))
  }

  mutateAssessment(assessment: CsraAssessment, formValues: Record<string, string | string[] | number | boolean>) {
    let mutatedAssessment = assessment

    this.questions.forEach(question => {
      mutatedAssessment = question.mutateAssessment(mutatedAssessment, formValues)
    })

    return mutatedAssessment
  }

  getFormValues(assessment: CsraAssessment) {
    return Object.fromEntries(this.questions.flatMap(q => Object.entries(q.getFormValues(assessment))))
  }
}

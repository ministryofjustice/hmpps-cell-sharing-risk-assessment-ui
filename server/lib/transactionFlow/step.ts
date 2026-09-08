import { CsraAssessmentStageAnswers } from '../../data/csraApiTypes'
import Question from './questionTypes/base'

export default class Step {
  title?: string

  bodyHtml?: string

  questions: Question[]

  protected dependants: { attribute: keyof CsraAssessmentStageAnswers; answer: string | boolean }[]

  protected incompleteUnlessConditions: { attribute: keyof CsraAssessmentStageAnswers; answer: string | boolean }[]

  constructor({ questions, title, bodyHtml }: Pick<Step, 'questions' | 'title' | 'bodyHtml'>) {
    this.questions = questions
    this.title = title
    this.bodyHtml = bodyHtml
    this.dependants = []
    this.incompleteUnlessConditions = []
  }

  incompleteUnless(attribute: keyof CsraAssessmentStageAnswers, answer: string | boolean) {
    this.incompleteUnlessConditions.push({ attribute, answer })
    return this
  }

  dependsOn(attribute: keyof CsraAssessmentStageAnswers, answer: string | boolean) {
    this.dependants.push({ attribute, answer })
    return this
  }

  removeIf(assessmentAnswers: CsraAssessmentStageAnswers) {
    return this.dependants.some(({ attribute, answer }) => assessmentAnswers[attribute] !== answer)
  }

  isComplete(assessmentAnswers: CsraAssessmentStageAnswers) {
    return (
      this.questions.every(q => q.isComplete(assessmentAnswers)) &&
      this.incompleteUnlessConditions.every(({ attribute, answer }) => assessmentAnswers[attribute] === answer)
    )
  }

  isAnswered(assessmentAnswers: CsraAssessmentStageAnswers) {
    return this.questions.every(q => q.isAnswered(assessmentAnswers))
  }

  mutateAssessmentAnswers(
    assessmentAnswers: CsraAssessmentStageAnswers,
    formValues: Record<string, string | string[] | number | boolean>,
  ) {
    let mutatedAssessmentAnswers = assessmentAnswers

    this.questions.forEach(question => {
      mutatedAssessmentAnswers = question.mutateAssessmentAnswers(mutatedAssessmentAnswers, formValues)
    })

    return mutatedAssessmentAnswers
  }

  getFormValues(assessmentAnswers: CsraAssessmentStageAnswers) {
    return Object.fromEntries(this.questions.flatMap(q => Object.entries(q.getFormValues(assessmentAnswers))))
  }
}

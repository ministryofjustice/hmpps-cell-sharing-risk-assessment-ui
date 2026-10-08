import { CsraAssessmentStageAnswers } from '../../data/csraApiTypes'
import Question from './questionTypes/base'

export default class Step {
  title?: string

  bodyHtml?: string

  questions: Question[]

  protected dependencies: {
    attribute: keyof Omit<CsraAssessmentStageAnswers, 'stage' | 'prisonId' | 'version'>
    answer: string | boolean
  }[]

  protected incompleteUnlessConditions: { attribute: keyof CsraAssessmentStageAnswers; answer: string | boolean }[]

  constructor({ questions, title, bodyHtml }: Pick<Step, 'questions' | 'title' | 'bodyHtml'>) {
    this.questions = questions
    this.title = title
    this.bodyHtml = bodyHtml
    this.dependencies = []
    this.incompleteUnlessConditions = []
  }

  incompleteUnless(attribute: keyof CsraAssessmentStageAnswers, answer: string | boolean) {
    this.incompleteUnlessConditions.push({ attribute, answer })
    return this
  }

  dependsOn(attribute: (typeof this.dependencies)[0]['attribute'], answer: string | boolean) {
    this.dependencies.push({ attribute, answer })
    return this
  }

  removeIf(assessmentAnswers: CsraAssessmentStageAnswers) {
    return this.dependencies.some(({ attribute, answer }) => assessmentAnswers[attribute] !== answer)
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

  eraseAnswers(assessmentAnswers: CsraAssessmentStageAnswers) {
    let mutatedAssessmentAnswers = assessmentAnswers

    this.questions.forEach(question => {
      mutatedAssessmentAnswers = question.eraseAnswers(mutatedAssessmentAnswers)
    })

    return mutatedAssessmentAnswers
  }
}

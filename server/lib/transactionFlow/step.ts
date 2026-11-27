import Question, { QuestionContext } from './questionTypes/base'
import BaseAnswersObject from './baseAnswersObject'

export default class Step<AnswersObject extends BaseAnswersObject> {
  title?: string

  bodyHtml?: string

  warningText?: string

  questions: Question<AnswersObject>[]

  protected dependencies: {
    attribute: keyof Omit<AnswersObject, 'stage' | 'prisonId' | 'version'>
    answer: string | boolean
  }[]

  protected incompleteUnlessConditions: { attribute: keyof AnswersObject; answer: string | boolean }[]

  protected conditions: ((assessmentAnswers: AnswersObject) => boolean)[]

  constructor({
    questions,
    title,
    bodyHtml,
    warningText,
  }: Pick<Step<AnswersObject>, 'questions' | 'title' | 'bodyHtml' | 'warningText'>) {
    this.questions = questions
    this.title = title
    this.bodyHtml = bodyHtml
    this.warningText = warningText
    this.dependencies = []
    this.incompleteUnlessConditions = []
    this.conditions = []
  }

  onlyWhen(condition: (assessmentAnswers: AnswersObject) => boolean) {
    this.conditions.push(condition)
    return this
  }

  incompleteUnless(attribute: keyof AnswersObject, answer: string | boolean) {
    this.incompleteUnlessConditions.push({ attribute, answer })
    return this
  }

  dependsOn(attribute: (typeof this.dependencies)[0]['attribute'], answer: string | boolean) {
    this.dependencies.push({ attribute, answer })
    return this
  }

  removeIf(assessmentAnswers: AnswersObject) {
    return (
      this.dependencies.some(({ attribute, answer }) => assessmentAnswers[attribute] !== answer) ||
      this.conditions.some(condition => !condition(assessmentAnswers))
    )
  }

  isComplete(assessmentAnswers: AnswersObject) {
    return (
      this.questions.every(q => q.isComplete(assessmentAnswers)) &&
      this.incompleteUnlessConditions.every(({ attribute, answer }) => assessmentAnswers[attribute] === answer)
    )
  }

  isAnswered(assessmentAnswers: AnswersObject) {
    return this.questions.every(q => q.isAnswered(assessmentAnswers))
  }

  mutateAssessmentAnswers(
    assessmentAnswers: AnswersObject,
    formValues: Record<string, string | string[] | number | boolean>,
    context?: QuestionContext<AnswersObject>,
  ) {
    let mutatedAssessmentAnswers = assessmentAnswers

    this.questions.forEach(question => {
      mutatedAssessmentAnswers = question.mutateAssessmentAnswers(mutatedAssessmentAnswers, formValues, context)
    })

    return mutatedAssessmentAnswers
  }

  getFormValues(assessmentAnswers: AnswersObject) {
    return Object.fromEntries(this.questions.flatMap(q => Object.entries(q.getFormValues(assessmentAnswers))))
  }

  eraseAnswers(assessmentAnswers: AnswersObject) {
    let mutatedAssessmentAnswers = assessmentAnswers

    this.questions.forEach(question => {
      mutatedAssessmentAnswers = question.eraseAnswers(mutatedAssessmentAnswers)
    })

    return mutatedAssessmentAnswers
  }
}

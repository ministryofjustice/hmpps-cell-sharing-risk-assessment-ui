export interface QuestionContext<AnswersObject extends object> {
  provisionalRatingEntered?: boolean
  assessmentAnswers?: AnswersObject
  provisionalAnswers?: AnswersObject
  availableOptions?: Record<string, readonly string[]>
  headingQuestionIds?: readonly string[]
}

export default abstract class Question<AnswersObject extends object> {
  constructor(
    public readonly question: string | null,
    public readonly id: string,
    public readonly component: string,
  ) {}

  abstract componentAttributes(
    validationErrors: Record<string, { text: string }> | undefined,
    values: FormValues | undefined,
    assessmentAnswers: AnswersObject,
    context?: QuestionContext<AnswersObject>,
  ): object

  abstract validations(context?: QuestionContext<AnswersObject>): ValidationFunction[]

  /** Converts the passed in API values to values that the component will use */
  abstract getFormValues(assessmentAnswers: AnswersObject): FormValues

  isComplete(assessmentAnswers: AnswersObject): boolean {
    return this.isAnswered(assessmentAnswers)
  }

  abstract isAnswered(assessmentAnswers: AnswersObject): boolean

  abstract mutateAssessmentAnswers(
    assessmentAnswers: AnswersObject,
    formValues: FormValues,
    context?: QuestionContext<AnswersObject>,
  ): AnswersObject

  abstract eraseAnswers(assessmentAnswers: AnswersObject): AnswersObject
}

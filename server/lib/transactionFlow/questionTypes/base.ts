import { CsraAssessmentStageAnswers } from '../../../data/csraApiTypes'

export interface QuestionContext {
  provisionalRatingEntered?: boolean
  assessmentAnswers?: CsraAssessmentStageAnswers
  provisionalAnswers?: CsraAssessmentStageAnswers
}

export default abstract class Question {
  constructor(
    public readonly question: string | null,
    public readonly id: string,
    public readonly component: string,
  ) {}

  abstract componentAttributes(
    validationErrors: Record<string, { text: string }> | undefined,
    values: FormValues | undefined,
    assessmentAnswers: CsraAssessmentStageAnswers,
    context?: QuestionContext,
  ): object

  abstract validations(context?: QuestionContext): ValidationFunction[]

  /** Converts the passed in API values to values that the component will use */
  abstract getFormValues(assessmentAnswers: CsraAssessmentStageAnswers): FormValues

  isComplete(assessmentAnswers: CsraAssessmentStageAnswers): boolean {
    return this.isAnswered(assessmentAnswers)
  }

  abstract isAnswered(assessmentAnswers: CsraAssessmentStageAnswers): boolean

  abstract mutateAssessmentAnswers(
    assessmentAnswers: CsraAssessmentStageAnswers,
    formValues: FormValues,
    context?: QuestionContext,
  ): CsraAssessmentStageAnswers

  abstract eraseAnswers(assessmentAnswers: CsraAssessmentStageAnswers): CsraAssessmentStageAnswers
}

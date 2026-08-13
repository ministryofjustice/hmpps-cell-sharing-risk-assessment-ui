import { CsraAssessment } from '../../../data/csraApiTypes'

export default abstract class Question {
  constructor(
    public readonly question: string,
    public readonly id: string,
    public readonly component: string,
  ) {}

  abstract componentAttributes(
    validationErrors: Record<string, { text: string }> | undefined,
    values: FormValues | undefined,
    assessment: CsraAssessment,
  ): object

  abstract validations(): ValidationFunction[]

  /** Converts the passed in API values to values that the component will use */
  abstract getFormValues(assessment: CsraAssessment): FormValues

  abstract isComplete(assessment: CsraAssessment): boolean

  abstract mutateAssessment(assessment: CsraAssessment, formValues: FormValues): CsraAssessment
}

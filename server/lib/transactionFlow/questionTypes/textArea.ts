import Question, { QuestionContext } from './base'
import BaseAnswersObject from '../baseAnswersObject'
import required from '../validations/required'

export type TextAreaValidationMessages = {
  required?: string
}

type TextAreaQuestionOptions = {
  classes?: string
  validationMessages?: TextAreaValidationMessages
}

export default class TextAreaQuestion<AnswersObject extends BaseAnswersObject> extends Question<AnswersObject> {
  constructor(
    question: string,
    public override id: keyof PickByType<AnswersObject, string> & string,
    private readonly options: TextAreaQuestionOptions = {},
  ) {
    super(question, id, 'govukTextarea')
  }

  override componentAttributes(
    validationErrors: Record<string, { text: string }> | undefined,
    values: Record<string, unknown> | undefined,
    _assessmentAnswers: AnswersObject,
    context?: QuestionContext<AnswersObject>,
  ): object {
    return {
      id: this.id,
      name: this.id,
      label: {
        text: this.question,
        classes: context?.headingQuestionIds?.includes(this.id) ? 'govuk-visually-hidden' : 'govuk-fieldset__legend--s',
      },
      value: values[this.id],
      errorMessage: validationErrors ? validationErrors[this.id] : undefined,
      classes: this.options.classes,
    }
  }

  override validations(): ValidationFunction[] {
    return [required(this.options.validationMessages?.required ?? 'There is a problem')]
  }

  override getFormValues(assessmentAnswers: AnswersObject): FormValues {
    return { [this.id]: assessmentAnswers[this.id] }
  }

  override isAnswered(assessmentAnswers: AnswersObject): boolean {
    return !!assessmentAnswers[this.id]
  }

  override mutateAssessmentAnswers(assessmentAnswers: AnswersObject, formValues: FormValues): AnswersObject {
    return { ...assessmentAnswers, [this.id]: formValues[this.id] }
  }

  override eraseAnswers(assessmentAnswers: AnswersObject): AnswersObject {
    return { ...assessmentAnswers, [this.id]: null }
  }
}

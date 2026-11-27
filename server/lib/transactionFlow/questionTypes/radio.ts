import Question, { QuestionContext } from './base'
import required from '../validations/required'
import FeComponentsService from '../../../services/feComponentsService'
import BaseAnswersObject from '../baseAnswersObject'

export type RadioQuestionOptions = {
  classes?: string
  hint?: string
  insetText?: string
  validationMessages?: { required?: string }
}

export default class RadioQuestion<
  AnswersObject extends BaseAnswersObject,
  AnswerValue = string,
> extends Question<AnswersObject> {
  constructor(
    question: string | null,
    public override id: keyof PickByType<AnswersObject, AnswerValue> & string,
    public items: { text: string; value: string; hint?: string; conditional?: Question<AnswersObject> }[],
    protected readonly options: RadioQuestionOptions = {},
  ) {
    super(question, id, 'govukRadios')
  }

  get hint() {
    return this.options.hint
  }

  get insetText() {
    return this.options.insetText
  }

  override componentAttributes(
    validationErrors: Record<string, { text: string }> | undefined,
    values: FormValues | undefined,
    assessmentAnswers: AnswersObject,
    context?: QuestionContext<AnswersObject>,
  ): object {
    return {
      id: this.id,
      name: this.id,
      fieldset: {
        legend: {
          text: this.question,
          classes: context?.headingQuestionIds?.includes(this.id)
            ? 'govuk-visually-hidden'
            : 'govuk-fieldset__legend--m',
        },
      },
      ...(this.options.hint ? { hint: { text: this.options.hint } } : {}),
      ...(this.options.classes ? { formGroup: { classes: this.options.classes } } : {}),
      items: this.items
        .filter(item => !context?.availableOptions?.[this.id] || context.availableOptions[this.id].includes(item.value))
        .map(item => {
          return {
            ...item,
            ...(item.hint ? { hint: { text: item.hint } } : {}),
            conditional: item.conditional
              ? {
                  html: FeComponentsService.getComponent(
                    item.conditional.component,
                    item.conditional.componentAttributes(validationErrors, values, assessmentAnswers, context),
                  ),
                }
              : undefined,
          }
        })
        .filter(i => i),
      value: values[this.id],
      errorMessage: validationErrors ? validationErrors[this.id] : undefined,
    }
  }

  override validations(): ValidationFunction[] {
    return [required(this.options.validationMessages?.required ?? 'There is a problem')]
  }

  override getFormValues(assessmentAnswers: AnswersObject): FormValues {
    const conditional = this.items.find(item => item.value === assessmentAnswers[this.id])?.conditional
    return {
      [this.id]: assessmentAnswers[this.id],
      ...(conditional ? conditional.getFormValues(assessmentAnswers) : {}),
    }
  }

  override isAnswered(assessmentAnswers: AnswersObject): boolean {
    const value = assessmentAnswers[this.id]
    if (!value) return false
    const conditional = this.items.find(item => item.value === value)?.conditional
    return conditional ? conditional.isAnswered(assessmentAnswers) : true
  }

  override mutateAssessmentAnswers(assessmentAnswers: AnswersObject, formValues: FormValues): AnswersObject {
    let mutatedAssessmentAnswers = { ...assessmentAnswers, [this.id]: formValues[this.id] }

    this.items
      .filter(i => i.conditional)
      .forEach(item => {
        if (formValues[this.id] === item.value) {
          mutatedAssessmentAnswers = item.conditional.mutateAssessmentAnswers(mutatedAssessmentAnswers, formValues)
        } else if (item.conditional.id in mutatedAssessmentAnswers) {
          mutatedAssessmentAnswers[item.conditional.id as Extract<keyof PickByType<AnswersObject, string>, string>] =
            null
        }
      })

    return mutatedAssessmentAnswers
  }

  override eraseAnswers(assessmentAnswers: AnswersObject): AnswersObject {
    let mutatedAssessmentAnswers: AnswersObject = { ...assessmentAnswers, [this.id]: null }

    this.items
      .filter(i => i.conditional)
      .forEach(item => {
        mutatedAssessmentAnswers = item.conditional.eraseAnswers(mutatedAssessmentAnswers)
      })

    return mutatedAssessmentAnswers
  }
}

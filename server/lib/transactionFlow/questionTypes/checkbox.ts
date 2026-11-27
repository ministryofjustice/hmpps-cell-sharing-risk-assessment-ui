import Question, { QuestionContext } from './base'
import FeComponentsService from '../../../services/feComponentsService'

export default abstract class CheckboxQuestion<AnswersObject extends object> extends Question<AnswersObject> {
  constructor(
    question: string,
    id: string,
    public items: CheckboxItem<AnswersObject>[],
    component = 'govukCheckboxes',
  ) {
    super(question, id, component)
  }

  override componentAttributes(
    validationErrors: Record<string, { text: string }> | undefined,
    values: FormValues | undefined,
    assessmentAnswers: AnswersObject,
    context?: QuestionContext<AnswersObject>,
  ) {
    return {
      multiple: true,
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
      items: this.items
        .map(item => {
          if (item.removeIf?.(assessmentAnswers)) {
            return null
          }

          return {
            ...item,
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
      values: values[this.id],
      errorMessage: validationErrors ? validationErrors[this.id] : undefined,
    }
  }
}

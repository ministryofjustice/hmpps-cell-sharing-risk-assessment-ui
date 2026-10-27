import Question, { QuestionContext } from './base'
import { CsraAssessmentStageAnswers } from '../../../data/csraApiTypes'
import FeComponentsService from '../../../services/feComponentsService'

export default abstract class CheckboxQuestion extends Question {
  constructor(
    question: string,
    id: string,
    public items: CheckboxItem[],
    component = 'govukCheckboxes',
  ) {
    super(question, id, component)
  }

  override componentAttributes(
    validationErrors: Record<string, { text: string }> | undefined,
    values: FormValues | undefined,
    assessmentAnswers: CsraAssessmentStageAnswers,
    context?: QuestionContext,
  ): object {
    return {
      multiple: true,
      id: this.id,
      name: this.id,
      fieldset: {
        legend: {
          text: this.question,
          classes: 'govuk-fieldset__legend--m',
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

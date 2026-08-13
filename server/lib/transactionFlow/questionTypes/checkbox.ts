import Question from './base'
import { CsraAssessment } from '../../../data/csraApiTypes'
import FeComponentsService from '../../../services/feComponentsService'
import required from '../validations/required'

export default abstract class CheckboxQuestion extends Question {
  constructor(
    question: string,
    id: string,
    public items: CheckboxItem[],
  ) {
    super(question, id, 'govukCheckboxes')
  }

  override componentAttributes(
    validationErrors: Record<string, { text: string }> | undefined,
    values: FormValues | undefined,
    assessment: CsraAssessment,
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
          if (item.removeIf?.(assessment)) {
            return null
          }

          return {
            ...item,
            conditional: item.conditional
              ? {
                  html: FeComponentsService.getComponent(
                    item.conditional.component,
                    item.conditional.componentAttributes(validationErrors, values, assessment),
                  ),
                }
              : undefined,
          }
        })
        .filter(i => i),
      values: values[this.id],
      errorMessage: validationErrors ? validationErrors[this.id]?.text : undefined,
    }
  }

  override validations(): ValidationFunction[] {
    return [required('At least 1 evidence source must be checked')]
  }
}

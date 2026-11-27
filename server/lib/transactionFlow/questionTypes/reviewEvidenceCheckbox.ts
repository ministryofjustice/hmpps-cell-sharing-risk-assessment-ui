import { CsraReviewAnswers, CsraReviewEvidenceSource } from '../../../data/csraApiTypes'
import CheckboxQuestion from './checkbox'
import OtherReviewEvidenceDetail from './otherReviewEvidenceDetail'
import required from '../validations/required'
import { QuestionContext } from './base'

export default class ReviewEvidenceCheckbox extends CheckboxQuestion<CsraReviewAnswers> {
  private readonly otherDetail: OtherReviewEvidenceDetail

  constructor(private readonly sources: { value: CsraReviewEvidenceSource; text: string }[]) {
    const otherDetail = new OtherReviewEvidenceDetail()
    super(
      'Which evidence sources have you checked?',
      'evidenceSources',
      sources.map(source => ({
        ...source,
        ...(source.value === 'OTHER' ? { conditional: otherDetail } : {}),
      })),
    )
    this.otherDetail = otherDetail
  }

  override componentAttributes(
    errors: Record<string, { text: string }>,
    values: FormValues,
    answers: CsraReviewAnswers,
    context?: QuestionContext<CsraReviewAnswers>,
  ) {
    const attributes = super.componentAttributes(errors, values, answers, context)
    const selected = values[this.id]
    return {
      ...attributes,
      items: attributes.items.map(item => ({
        ...item,
        checked: Array.isArray(selected) ? selected.includes(item.value) : selected === item.value,
      })),
    }
  }

  validations(): ValidationFunction[] {
    return [
      required('Select at least one evidence source you have checked'),
      value => {
        const selected = typeof value === 'string' ? [value] : value
        if (
          !Array.isArray(selected) ||
          selected.some(source => !this.items.some(item => item.value === source)) ||
          new Set(selected).size !== selected.length
        ) {
          return 'Select valid evidence sources'
        }
        return null
      },
    ]
  }

  getFormValues(answers: CsraReviewAnswers): FormValues {
    return {
      [this.id]: answers.evidenceSources.map(item => item.source),
      ...this.otherDetail.getFormValues(answers),
    }
  }

  isAnswered(answers: CsraReviewAnswers): boolean {
    return (
      answers.evidenceSources.length > 0 &&
      (!answers.evidenceSources.some(item => item.source === 'OTHER') || this.otherDetail.isAnswered(answers))
    )
  }

  mutateAssessmentAnswers(answers: CsraReviewAnswers, values: FormValues): CsraReviewAnswers {
    const value = values[this.id]
    const selected = typeof value === 'string' ? [value] : value
    const evidenceSources = (Array.isArray(selected) ? selected : []).map(selectedValue => {
      const source = this.sources.find(item => item.value === selectedValue)
      if (!source) throw new Error(`Invalid evidence source: ${selectedValue}`)
      return { source: source.value }
    })
    let updated = { ...answers, evidenceSources }
    if (evidenceSources.some(item => item.source === 'OTHER')) {
      updated = this.otherDetail.mutateAssessmentAnswers(updated, values)
    }
    return updated
  }

  eraseAnswers(answers: CsraReviewAnswers): CsraReviewAnswers {
    return { ...answers, evidenceSources: [] }
  }
}

import { CsraReviewAnswers } from '../../../data/csraApiTypes'
import Question from './base'

export default class OtherReviewEvidenceDetail extends Question<CsraReviewAnswers> {
  constructor() {
    super('Enter the other evidence source', 'otherEvidenceDetail', 'govukInput')
  }

  componentAttributes(errors: Record<string, { text: string }>, values: FormValues) {
    return {
      id: this.id,
      name: this.id,
      label: { text: this.question },
      value: values[this.id],
      errorMessage: errors?.[this.id],
    }
  }

  validations(): ValidationFunction[] {
    return [value => (typeof value === 'string' && value.trim() ? null : 'Enter the other evidence source')]
  }

  getFormValues(answers: CsraReviewAnswers): FormValues {
    return { [this.id]: answers.evidenceSources.find(item => item.source === 'OTHER')?.details ?? '' }
  }

  isAnswered(answers: CsraReviewAnswers): boolean {
    return !!answers.evidenceSources.find(item => item.source === 'OTHER')?.details?.trim()
  }

  mutateAssessmentAnswers(answers: CsraReviewAnswers, values: FormValues): CsraReviewAnswers {
    const detail = values[this.id]
    return {
      ...answers,
      evidenceSources: answers.evidenceSources.map(item =>
        item.source === 'OTHER' ? { ...item, details: typeof detail === 'string' ? detail.trim() : '' } : item,
      ),
    }
  }

  eraseAnswers(answers: CsraReviewAnswers): CsraReviewAnswers {
    return answers
  }
}

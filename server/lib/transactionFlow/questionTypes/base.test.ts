import { CsraAssessmentStageAnswers } from '../../../data/csraApiTypes'
import Question from './base'

class TestQuestion extends Question {
  override componentAttributes(): object {
    return { id: this.id }
  }

  override validations(): ValidationFunction[] {
    return []
  }

  override getFormValues(): FormValues {
    return { [this.id]: 'value' }
  }

  override isAnswered(_assessment: CsraAssessmentStageAnswers): boolean {
    return true
  }

  override mutateAssessmentAnswers(assessment: CsraAssessmentStageAnswers): CsraAssessmentStageAnswers {
    return assessment
  }
}

describe('Question base class', () => {
  it('stores constructor values on the instance', () => {
    const question = new TestQuestion('Question text', 'questionId', 'govukInput')

    expect(question.question).toBe('Question text')
    expect(question.id).toBe('questionId')
    expect(question.component).toBe('govukInput')
    expect(question.componentAttributes()).toEqual({ id: 'questionId' })
    expect(question.getFormValues()).toEqual({ questionId: 'value' })
  })
})

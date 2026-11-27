import RadioQuestion from './radio'
import TextAreaQuestion from './textArea'

type Answers = { reason?: string; detail?: string }

describe('RadioQuestion', () => {
  const question = new RadioQuestion<Answers>('Reason?', 'reason', [
    { text: 'First', value: 'FIRST' },
    { text: 'Second', value: 'SECOND' },
  ])

  it('reads and writes string answers', () => {
    expect(question.getFormValues({ reason: 'SECOND' })).toEqual({ reason: 'SECOND' })
    expect(question.isAnswered({ reason: 'SECOND' })).toBe(true)
    expect(question.isAnswered({})).toBe(false)
    expect(question.mutateAssessmentAnswers({}, { reason: 'FIRST' })).toEqual({ reason: 'FIRST' })
    expect(question.eraseAnswers({ reason: 'FIRST' })).toEqual({ reason: null })
  })

  it('restores and requires the selected conditional answer', () => {
    const conditionalQuestion = new RadioQuestion<Answers>('Reason?', 'reason', [
      { text: 'First', value: 'FIRST' },
      { text: 'Second', value: 'SECOND', conditional: new TextAreaQuestion<Answers>('Details', 'detail') },
    ])
    expect(conditionalQuestion.getFormValues({ reason: 'SECOND', detail: 'Existing detail' })).toEqual({
      reason: 'SECOND',
      detail: 'Existing detail',
    })
    expect(conditionalQuestion.isAnswered({ reason: 'SECOND' })).toBe(false)
    expect(conditionalQuestion.isAnswered({ reason: 'SECOND', detail: 'Existing detail' })).toBe(true)
    expect(conditionalQuestion.isAnswered({ reason: 'FIRST' })).toBe(true)
  })
})

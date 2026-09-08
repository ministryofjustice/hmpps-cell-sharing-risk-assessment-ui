import YesNoWithDetailQuestion from './yesNoWithDetail'
import TextAreaQuestion from './textArea'

describe('YesNoWithDetailQuestion', () => {
  it('adds a detail text area to the YES option', () => {
    const question = new YesNoWithDetailQuestion(
      'Is there a concern?',
      'likelyToHarmCellmate',
      'likelyToHarmCellmateDetail',
      'A hint',
    )

    expect(question.question).toBe('Is there a concern?')
    expect(question.id).toBe('likelyToHarmCellmate')
    expect(question.hint).toBe('A hint')
    expect(question.items[0]).toEqual(
      expect.objectContaining({
        value: 'YES',
        conditional: expect.any(TextAreaQuestion),
      }),
    )
    expect(question.items[1]).toEqual(expect.objectContaining({ value: 'NO' }))
    expect((question.items[0].conditional as TextAreaQuestion).id).toBe('likelyToHarmCellmateDetail')
  })
})

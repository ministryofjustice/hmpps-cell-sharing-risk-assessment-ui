import YesNoWithDetailQuestion from './yesNoWithDetail'
import TextAreaQuestion from './textArea'

describe('YesNoWithDetailQuestion', () => {
  it('uses the default required-selection message when none is configured', () => {
    const question = new YesNoWithDetailQuestion(
      'Is there a concern?',
      'likelyToHarmCellmate',
      'likelyToHarmCellmateDetail',
    )
    const [validate] = question.validations()

    expect(validate(undefined)).toBe('There is a problem')
  })

  it('uses a configured required-selection message independently of the detail message', () => {
    const question = new YesNoWithDetailQuestion(
      'Are there any other indicators to suggest the prisoner is high risk?',
      'otherHighRiskIndicators',
      'otherHighRiskIndicatorsDetail',
      {
        validationMessages: { required: 'Select yes if there are other risk factors' },
        detailValidationMessages: { required: 'Enter details of the risk' },
      },
    )
    const [validate] = question.validations()
    const [validateDetail] = question.items[0].conditional.validations()

    expect(validate(undefined)).toBe('Select yes if there are other risk factors')
    expect(validate('')).toBe('Select yes if there are other risk factors')
    expect(validate('YES')).toBeNull()
    expect(validate('NO')).toBeNull()
    expect(validateDetail('')).toBe('Enter details of the risk')
  })

  it('adds a detail text area to the YES option', () => {
    const question = new YesNoWithDetailQuestion(
      'Is there a concern?',
      'likelyToHarmCellmate',
      'likelyToHarmCellmateDetail',
      { hint: 'A hint' },
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

  it('passes detail validation messages to the text area', () => {
    const question = new YesNoWithDetailQuestion(
      'Is there a concern?',
      'likelyToHarmCellmate',
      'likelyToHarmCellmateDetail',
      { detailValidationMessages: { required: 'Enter details of the risk' } },
    )
    const detailQuestion = question.items[0].conditional as TextAreaQuestion
    const [validate] = detailQuestion.validations()

    expect(validate('')).toBe('Enter details of the risk')
  })
})

import { CsraAssessmentStageAnswers } from '../../../data/csraApiTypes'
import YesNoQuestion from './yesNo'
import TextAreaQuestion from './textArea'
import RadioQuestion from './radio'

const makeAssessment = (overrides: Partial<CsraAssessmentStageAnswers> = {}): CsraAssessmentStageAnswers => ({
  stage: 'PROVISIONAL',
  prisonId: 'MDI',
  offenceEvidence: [],
  riskTo: [],
  vulnerabilities: [],
  version: 1,
  ...overrides,
})

describe('YesNoQuestion', () => {
  const question = new YesNoQuestion<CsraAssessmentStageAnswers>('Any evidence?', 'offenceMurderManslaughter')

  it('is a radio question', () => {
    expect(question).toBeInstanceOf(RadioQuestion)
  })

  it('builds radio component attributes', () => {
    const result = question.componentAttributes(
      { offenceMurderManslaughter: { text: 'Select one' } },
      { offenceMurderManslaughter: 'YES' },
      makeAssessment(),
    ) as {
      items: Array<{ text: string; value: string }>
      errorMessage?: string
      value?: string
    }

    expect(result.items).toEqual([
      { text: 'Yes', value: 'YES' },
      { text: 'No', value: 'NO' },
    ])
    expect(result.value).toBe('YES')
    expect(result.errorMessage).toEqual({ text: 'Select one' })
  })

  it('uses required validation', () => {
    const [validate] = question.validations()

    expect(validate(undefined)).toBe('There is a problem')
    expect(validate('YES')).toBeNull()
  })

  it.each([
    ['YES for true', true, 'YES'],
    ['NO for false', false, 'NO'],
    ['undefined when unanswered', undefined, undefined],
  ])('%s', (_label: string, value: boolean | undefined, expected: string | undefined) => {
    expect(question.getFormValues(makeAssessment({ offenceMurderManslaughter: value as boolean }))).toEqual({
      offenceMurderManslaughter: expected,
    })
  })

  it('reports completion only when answered', () => {
    expect(question.isAnswered(makeAssessment({ offenceMurderManslaughter: true }))).toBe(true)
    expect(question.isAnswered(makeAssessment({ offenceMurderManslaughter: false }))).toBe(true)

    const unanswered = {
      ...makeAssessment(),
      offenceMurderManslaughter: undefined,
    } as unknown as CsraAssessmentStageAnswers
    expect(question.isAnswered(unanswered)).toBe(false)
  })

  it('maps form values back into boolean assessment values', () => {
    expect(
      question.mutateAssessmentAnswers(makeAssessment(), { offenceMurderManslaughter: 'YES' })
        .offenceMurderManslaughter,
    ).toBe(true)
    expect(
      question.mutateAssessmentAnswers(makeAssessment(), { offenceMurderManslaughter: 'NO' }).offenceMurderManslaughter,
    ).toBe(false)
  })

  it.each([
    ['YES', true, 'likelyToHarmCellmateDetail', 'significantlyVulnerableDetail'],
    ['NO', false, 'significantlyVulnerableDetail', 'likelyToHarmCellmateDetail'],
  ] as const)('handles the selected %s conditional', (selection, answer, selectedField, otherField) => {
    const conditionalQuestion = new YesNoQuestion<CsraAssessmentStageAnswers>(
      'Any risk?',
      'likelyToHarmCellmate',
      undefined,
      [
        {
          text: 'Yes',
          value: 'YES',
          conditional: new TextAreaQuestion<CsraAssessmentStageAnswers>('Risk detail', 'likelyToHarmCellmateDetail'),
        },
        {
          text: 'No',
          value: 'NO',
          conditional: new TextAreaQuestion<CsraAssessmentStageAnswers>(
            'Other detail',
            'significantlyVulnerableDetail',
          ),
        },
      ],
    )
    const assessment = makeAssessment({
      likelyToHarmCellmate: answer,
      likelyToHarmCellmateDetail: 'Yes detail',
      significantlyVulnerableDetail: 'No detail',
    })

    expect(conditionalQuestion.getFormValues(assessment)).toEqual({
      likelyToHarmCellmate: selection,
      [selectedField]: assessment[selectedField],
    })
    expect(conditionalQuestion.isAnswered(assessment)).toBe(true)
    expect(conditionalQuestion.isAnswered({ ...assessment, [selectedField]: null })).toBe(false)
    expect(
      conditionalQuestion.mutateAssessmentAnswers(assessment, {
        likelyToHarmCellmate: selection,
        [selectedField]: 'Updated detail',
      }),
    ).toEqual({ ...assessment, [selectedField]: 'Updated detail', [otherField]: null })
  })

  it.each([true, false])('clears an answer of %s and conditionals on both options', value => {
    const conditionalQuestion = new YesNoQuestion<CsraAssessmentStageAnswers>(
      'Any risk?',
      'likelyToHarmCellmate',
      undefined,
      [
        {
          text: 'Yes',
          value: 'YES',
          conditional: new TextAreaQuestion<CsraAssessmentStageAnswers>('Risk detail', 'likelyToHarmCellmateDetail'),
        },
        {
          text: 'No',
          value: 'NO',
          conditional: new TextAreaQuestion<CsraAssessmentStageAnswers>(
            'Other detail',
            'significantlyVulnerableDetail',
          ),
        },
      ],
    )
    const assessment = makeAssessment({
      likelyToHarmCellmate: value,
      likelyToHarmCellmateDetail: 'Risk detail',
      significantlyVulnerableDetail: 'Other detail',
      seenByHealthcare: true,
    })
    const original = structuredClone(assessment)

    expect(conditionalQuestion.eraseAnswers(assessment)).toEqual({
      ...assessment,
      likelyToHarmCellmate: null,
      likelyToHarmCellmateDetail: null,
      significantlyVulnerableDetail: null,
    })
    expect(assessment).toEqual(original)
  })
})

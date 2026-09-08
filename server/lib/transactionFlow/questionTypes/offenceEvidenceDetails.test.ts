import { CsraAssessmentStageAnswers } from '../../../data/csraApiTypes'
import OffenceEvidenceDetailsQuestion from './offenceEvidenceDetails'

const makeAssessment = (overrides: Partial<CsraAssessmentStageAnswers> = {}): CsraAssessmentStageAnswers => ({
  stage: 'PROVISIONAL',
  prisonId: 'MDI',
  offenceEvidence: [
    { offence: 'MURDER_MANSLAUGHTER', sources: [], details: '' },
    { offence: 'ASSISTING_SUICIDE', sources: [], details: 'existing' },
  ],
  riskTo: [],
  vulnerabilities: [],
  version: 1,
  ...overrides,
})

describe('OffenceEvidenceDetailsQuestion', () => {
  const question = new OffenceEvidenceDetailsQuestion('MURDER_MANSLAUGHTER')

  it('updates details on the matching offence only', () => {
    const mutated = question.mutateAssessmentAnswers(makeAssessment(), {
      likelyToHarmCellmateDetail: 'new detail text',
    })

    expect(mutated.offenceEvidence[0].details).toBe('new detail text')
    expect(mutated.offenceEvidence[1].details).toBe('existing')
  })

  it('reads values from offence evidence details', () => {
    expect(
      question.getFormValues(
        makeAssessment({ offenceEvidence: [{ offence: 'MURDER_MANSLAUGHTER', sources: [], details: 'detail' }] }),
      ),
    ).toEqual({ likelyToHarmCellmateDetail: 'detail' })
    expect(question.getFormValues(makeAssessment({ offenceEvidence: [] }))).toEqual({
      likelyToHarmCellmateDetail: '',
    })
  })

  it('is complete only when detail text exists', () => {
    expect(
      question.isAnswered(
        makeAssessment({ offenceEvidence: [{ offence: 'MURDER_MANSLAUGHTER', sources: [], details: 'done' }] }),
      ),
    ).toBe(true)
    expect(
      question.isAnswered(
        makeAssessment({ offenceEvidence: [{ offence: 'MURDER_MANSLAUGHTER', sources: [], details: '' }] }),
      ),
    ).toBe(false)
  })
})

import { CsraAssessment } from '../../../data/csraApiTypes'
import OffenceEvidenceDetailsQuestion from './offenceEvidenceDetails'

const makeAssessment = (overrides: Partial<CsraAssessment> = {}): CsraAssessment => ({
  rating: 'STANDARD',
  prisonId: 'MDI',
  assessmentComment: '',
  dpsChecked: false,
  perChecked: false,
  warrantChecked: false,
  pncChecked: false,
  offenceMurderManslaughter: false,
  offenceAssistingSuicide: false,
  offenceSexualAssault: false,
  offenceRepeatedViolence: false,
  offencePrejudiceMotivated: false,
  offenceArson: false,
  offenceKidnapHostage: false,
  offenceEvidence: [
    { offence: 'MURDER_MANSLAUGHTER', sources: [], details: '' },
    { offence: 'ASSISTING_SUICIDE', sources: [], details: 'existing' },
  ],
  officerSpokeToPrisoner: false,
  likelyToHarmCellmate: false,
  significantlyVulnerable: false,
  causeForConcernSharing: false,
  otherHighRiskIndicators: false,
  seenByHealthcare: false,
  healthcareIncreasedRisk: false,
  riskTo: [],
  vulnerabilities: [],
  ...overrides,
})

describe('OffenceEvidenceDetailsQuestion', () => {
  const question = new OffenceEvidenceDetailsQuestion('MURDER_MANSLAUGHTER')

  it('updates details on the matching offence only', () => {
    const mutated = question.mutateAssessment(makeAssessment(), { assessmentComment: 'new detail text' })

    expect(mutated.offenceEvidence[0].details).toBe('new detail text')
    expect(mutated.offenceEvidence[1].details).toBe('existing')
  })

  it('reads values from offence evidence details', () => {
    expect(
      question.getFormValues(
        makeAssessment({ offenceEvidence: [{ offence: 'MURDER_MANSLAUGHTER', sources: [], details: 'detail' }] }),
      ),
    ).toEqual({ assessmentComment: 'detail' })
    expect(question.getFormValues(makeAssessment({ offenceEvidence: [] }))).toEqual({ assessmentComment: '' })
  })

  it('is complete only when detail text exists', () => {
    expect(
      question.isComplete(
        makeAssessment({ offenceEvidence: [{ offence: 'MURDER_MANSLAUGHTER', sources: [], details: 'done' }] }),
      ),
    ).toBe(true)
    expect(
      question.isComplete(
        makeAssessment({ offenceEvidence: [{ offence: 'MURDER_MANSLAUGHTER', sources: [], details: '' }] }),
      ),
    ).toBe(false)
  })
})

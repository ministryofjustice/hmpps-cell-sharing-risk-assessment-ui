import { CsraAssessment } from '../../../data/csraApiTypes'
import YesNoQuestion from './yesNo'
import OffenceEvidenceSourceCheckboxQuestion from './offenceEvidenceSourceCheckbox'

const makeAssessment = (overrides: Partial<CsraAssessment> = {}): CsraAssessment => ({
  rating: 'STANDARD',
  prisonId: 'MDI',
  assessmentComment: '',
  dpsChecked: true,
  perChecked: true,
  warrantChecked: true,
  pncChecked: true,
  offenceMurderManslaughter: true,
  offenceAssistingSuicide: false,
  offenceSexualAssault: false,
  offenceRepeatedViolence: false,
  offencePrejudiceMotivated: false,
  offenceArson: false,
  offenceKidnapHostage: false,
  offenceEvidence: [
    { offence: 'MURDER_MANSLAUGHTER', sources: ['PNC'], details: 'A detail' },
    { offence: 'ASSISTING_SUICIDE', sources: ['DPS'], details: 'Keep this' },
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

describe('OffenceEvidenceSourceCheckboxQuestion', () => {
  const yesNo = new YesNoQuestion('Is there any evidence of offence X?', 'offenceMurderManslaughter')
  const question = new OffenceEvidenceSourceCheckboxQuestion(yesNo, 'MURDER_MANSLAUGHTER')

  it('rewords the question text', () => {
    expect(question.question).toBe('Where did you find evidence of offence X?')
  })

  it('updates matching offence sources and other detail when OTHER is selected', () => {
    const mutated = question.mutateAssessment(makeAssessment(), {
      evidenceSources: ['DPS', 'OTHER'],
      otherSource: 'Intel report',
    })

    expect(mutated.offenceEvidence[0]).toEqual({
      offence: 'MURDER_MANSLAUGHTER',
      sources: ['DPS', 'OTHER'],
      details: 'A detail',
      otherSourceDetail: 'Intel report',
    })
    expect(mutated.offenceEvidence[1]).toEqual({
      offence: 'ASSISTING_SUICIDE',
      sources: ['DPS'],
      details: 'Keep this',
    })
  })

  it('returns source values plus conditional values', () => {
    expect(
      question.getFormValues(
        makeAssessment({
          offenceEvidence: [
            {
              offence: 'MURDER_MANSLAUGHTER',
              sources: ['OTHER'],
              details: 'A detail',
              otherSourceDetail: 'Witness account',
            },
          ],
        }),
      ),
    ).toEqual({
      evidenceSources: ['OTHER'],
      otherSource: 'Witness account',
    })
  })

  it('is complete when sources are present in evidence data', () => {
    expect(question.isComplete(makeAssessment())).toBe(true)
    expect(question.isComplete(makeAssessment({ offenceEvidence: [] }))).toBe(false)
  })
})

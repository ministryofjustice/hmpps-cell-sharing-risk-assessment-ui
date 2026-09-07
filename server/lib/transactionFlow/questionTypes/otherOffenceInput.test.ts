import { CsraAssessment } from '../../../data/csraApiTypes'
import OtherOffenceInputQuestion from './otherOffenceInput'

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
    { offence: 'ASSISTING_SUICIDE', sources: [], details: 'keep me' },
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

describe('OtherOffenceInputQuestion', () => {
  const question = new OtherOffenceInputQuestion('Evidence source', 'otherSource', 'MURDER_MANSLAUGHTER')

  it('builds input component attributes', () => {
    const result = question.componentAttributes(
      { otherSource: { text: 'Enter a reason' } },
      { otherSource: 'intelligence report' },
      makeAssessment(),
    ) as { value?: string; errorMessage?: string; classes: string }

    expect(result.value).toBe('intelligence report')
    expect(result.classes).toBe('govuk-input--width-10')
    expect(result.errorMessage).toBe('Enter a reason')
  })

  it('uses required validation', () => {
    const [validate] = question.validations()

    expect(validate('')).toBe('TODO: enter a reason')
    expect(validate('detail')).toBeNull()
  })

  it('updates other source detail for the matching offence only', () => {
    const mutated = question.mutateAssessment(makeAssessment(), { otherSource: 'Bodycam statement' })

    expect(mutated.offenceEvidence[0].otherSourceDetail).toBe('Bodycam statement')
    expect(mutated.offenceEvidence[1].otherSourceDetail).toBeUndefined()
  })

  it('maps values and completion from offence evidence', () => {
    expect(
      question.getFormValues(
        makeAssessment({
          offenceEvidence: [
            { offence: 'MURDER_MANSLAUGHTER', sources: [], details: '', otherSourceDetail: 'PER note' },
          ],
        }),
      ),
    ).toEqual({ otherSource: 'PER note' })

    expect(
      question.isComplete(
        makeAssessment({
          offenceEvidence: [{ offence: 'MURDER_MANSLAUGHTER', sources: [], details: '', otherSourceDetail: 'done' }],
        }),
      ),
    ).toBe(true)
    expect(
      question.isComplete(
        makeAssessment({ offenceEvidence: [{ offence: 'MURDER_MANSLAUGHTER', sources: [], details: '' }] }),
      ),
    ).toBe(false)
  })
})

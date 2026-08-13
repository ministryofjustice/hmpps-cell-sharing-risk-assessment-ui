import OffenceEvidenceStep from './offenceEvidenceStep'
import EvidenceCheckboxQuestion from './questionTypes/evidenceCheckbox'
import YesNoQuestion from './questionTypes/yesNo'
import Step from './step'
import config from './config'

describe('transaction flow config', () => {
  it('defines expected top-level sections', () => {
    expect(Object.keys(config)).toEqual([
      'evidenceAndOffences',
      'conversationAndVulnerability',
      'observation',
      'otherRisks',
      'healthcare',
    ])
  })

  it('builds evidence and offences steps in expected order', () => {
    const section = config.evidenceAndOffences

    expect(section.title).toBe('Offences')
    expect(section.steps).toHaveLength(6)

    expect(section.steps[0]).toBeInstanceOf(Step)
    const evidenceStep = section.steps[0] as Step
    expect(evidenceStep.title).toBe('Evidence sources')
    expect(evidenceStep.questions).toHaveLength(1)
    expect(evidenceStep.questions[0]).toBeInstanceOf(EvidenceCheckboxQuestion)

    expect(section.steps[1]).toBeInstanceOf(Step)
    const firstYesNoGroup = section.steps[1] as Step
    expect(firstYesNoGroup.questions).toHaveLength(2)
    expect(firstYesNoGroup.questions[0]).toBeInstanceOf(YesNoQuestion)
    expect(firstYesNoGroup.questions[1]).toBeInstanceOf(YesNoQuestion)

    expect((section.steps[2] as OffenceEvidenceStep).offenceType).toBe('MURDER_MANSLAUGHTER')
    expect((section.steps[3] as OffenceEvidenceStep).offenceType).toBe('ASSISTING_SUICIDE')

    expect(section.steps[4]).toBeInstanceOf(Step)
    const secondYesNoGroup = section.steps[4] as Step
    expect(secondYesNoGroup.questions).toHaveLength(1)
    expect(secondYesNoGroup.questions[0]).toBeInstanceOf(YesNoQuestion)

    expect((section.steps[5] as OffenceEvidenceStep).offenceType).toBe('SEXUAL_ASSAULT')
  })

  it('leaves remaining sections empty for now', () => {
    expect(config.conversationAndVulnerability.steps).toEqual([])
    expect(config.observation.steps).toEqual([])
    expect(config.otherRisks.steps).toEqual([])
    expect(config.healthcare.steps).toEqual([])
  })
})

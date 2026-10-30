import OffenceEvidenceStep from './offenceEvidenceStep'
import EvidenceCheckboxQuestion from './questionTypes/evidenceCheckbox'
import YesNoQuestion from './questionTypes/yesNo'
import Step from './step'
import InformationStep from './informationStep'
import config from './config'
import { CsraAssessmentStageAnswers } from '../../data/csraApiTypes'

const answersForStage = (stage: 'PROVISIONAL' | 'FINAL'): CsraAssessmentStageAnswers => ({
  stage,
  prisonId: 'MDI',
  offenceEvidence: [],
  riskTo: [],
  vulnerabilities: [],
  version: 1,
})

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
    expect(section.steps).toHaveLength(15)

    expect(section.steps[0]).toBeInstanceOf(Step)
    const evidenceStep = section.steps[0] as Step
    expect(evidenceStep.title).toBe('Evidence sources')
    expect(evidenceStep.questions).toHaveLength(1)
    expect(evidenceStep.questions[0]).toBeInstanceOf(EvidenceCheckboxQuestion)

    expect(section.steps[1]).toBeInstanceOf(InformationStep)
    expect(section.steps[1].title).toBe('Review offences after checking new evidence source')
    expect(section.steps[1].removeIf(answersForStage('PROVISIONAL'))).toBe(true)
    expect(section.steps[1].removeIf(answersForStage('FINAL'))).toBe(false)

    expect(section.steps[2]).toBeInstanceOf(Step)
    const firstYesNoGroup = section.steps[2] as Step
    expect(firstYesNoGroup.questions).toHaveLength(2)
    expect(firstYesNoGroup.questions[0]).toBeInstanceOf(YesNoQuestion)
    expect(firstYesNoGroup.questions[1]).toBeInstanceOf(YesNoQuestion)

    expect((section.steps[3] as OffenceEvidenceStep).offenceType).toBe('MURDER_MANSLAUGHTER')
    expect((section.steps[4] as OffenceEvidenceStep).offenceType).toBe('ASSISTING_SUICIDE')

    expect(section.steps[5]).toBeInstanceOf(Step)
    const secondYesNoGroup = section.steps[5] as Step
    expect(secondYesNoGroup.questions).toHaveLength(1)
    expect(secondYesNoGroup.questions[0]).toBeInstanceOf(YesNoQuestion)

    expect((section.steps[6] as OffenceEvidenceStep).offenceType).toBe('SEXUAL_ASSAULT')
    expect((section.steps[14] as OffenceEvidenceStep).offenceType).toBe('KIDNAP_HOSTAGE')
  })

  it('builds remaining sections', () => {
    expect(config.conversationAndVulnerability.steps).toHaveLength(3)
    expect(config.observation.steps).toHaveLength(1)
    expect(config.otherRisks.steps).toHaveLength(1)
    expect(config.healthcare.steps).toHaveLength(2)
  })
})

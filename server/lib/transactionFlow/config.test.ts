import OffenceEvidenceStep from './offenceEvidenceStep'
import EvidenceCheckboxQuestion from './questionTypes/evidenceCheckbox'
import YesNoQuestion from './questionTypes/yesNo'
import Step from './step'
import config, { getFlowConfig } from './config'
import { CsraAssessmentStageAnswers } from '../../data/csraApiTypes'

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
    expect(section.steps).toHaveLength(14)

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
    expect((section.steps[13] as OffenceEvidenceStep).offenceType).toBe('KIDNAP_HOSTAGE')
  })

  it('builds remaining sections', () => {
    expect(config.conversationAndVulnerability.steps).toHaveLength(3)
    expect(config.observation.steps).toHaveLength(1)
    expect(config.otherRisks.steps).toHaveLength(1)
    expect(config.healthcare.steps).toHaveLength(2)
  })

  describe('phase-specific flow', () => {
    const provisionalAnswers: CsraAssessmentStageAnswers = {
      stage: 'PROVISIONAL',
      prisonId: 'MDI',
      pncChecked: true,
      offenceEvidence: [],
      riskTo: [],
      vulnerabilities: [],
      version: 3,
    }

    it('preserves the initial flow and existing step positions', () => {
      expect(getFlowConfig({ phase: 'INITIAL', answers: provisionalAnswers })).toBe(config)
      const finalFlow = getFlowConfig({
        phase: 'POST_PROVISIONAL',
        provisionalAnswers,
        answers: { ...provisionalAnswers, stage: 'FINAL' },
      })

      expect(finalFlow.evidenceAndOffences.steps.slice(1)).toEqual(config.evidenceAndOffences.steps.slice(1))
      expect(finalFlow.healthcare).toBe(config.healthcare)
      expect(finalFlow.evidenceAndOffences.steps[0].bodyHtml).toBeUndefined()
      expect(finalFlow.evidenceAndOffences.steps[0].questions).toEqual([
        expect.objectContaining({ checkedSources: [expect.objectContaining({ text: 'PNC' })] }),
      ])
      expect(config.evidenceAndOffences.steps[0].bodyHtml).toContain('You must review all')
    })

    it('does not render an empty checkbox group when all sources were checked provisionally', () => {
      const completeAnswers = { ...provisionalAnswers, dpsChecked: true, perChecked: true, warrantChecked: true }
      const flow = getFlowConfig({
        phase: 'POST_PROVISIONAL',
        provisionalAnswers: completeAnswers,
        answers: { ...completeAnswers, stage: 'FINAL' },
      })
      const step = flow.evidenceAndOffences.steps[0]

      expect(step.questions).toEqual([
        expect.objectContaining({
          items: [],
          checkedSources: ['PNC', 'Warrant', 'DPS', 'PER'].map(text => expect.objectContaining({ text })),
        }),
      ])
      expect(step.isComplete(completeAnswers)).toBe(true)
    })

    it('does not share baseline selections between assessments', () => {
      const firstFlow = getFlowConfig({
        phase: 'POST_PROVISIONAL',
        provisionalAnswers,
        answers: { ...provisionalAnswers, stage: 'FINAL' },
      })
      const otherAnswers = { ...provisionalAnswers, pncChecked: false, dpsChecked: true }
      const secondFlow = getFlowConfig({
        phase: 'POST_PROVISIONAL',
        provisionalAnswers: otherAnswers,
        answers: { ...otherAnswers, stage: 'FINAL' },
      })

      expect(secondFlow.evidenceAndOffences.steps[0].questions[0]).toEqual(
        expect.objectContaining({ checkedSources: [expect.objectContaining({ text: 'DPS' })] }),
      )
      expect(firstFlow.evidenceAndOffences.steps[0].questions[0]).toEqual(
        expect.objectContaining({ checkedSources: [expect.objectContaining({ text: 'PNC' })] }),
      )
      expect(config.evidenceAndOffences.steps[0].questions[0]).toEqual(expect.objectContaining({ checkedSources: [] }))
    })
  })
})

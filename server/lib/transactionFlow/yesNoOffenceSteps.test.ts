import OffenceEvidenceStep from './offenceEvidenceStep'
import YesNoQuestion from './questionTypes/yesNo'
import Step from './step'
import YesNoOffenceSteps from './yesNoOffenceSteps'

describe('YesNoOffenceSteps', () => {
  it('builds one yes/no step followed by one evidence step per offence', () => {
    const murder = new YesNoQuestion('Murder evidence?', 'offenceMurderManslaughter')
    const assisting = new YesNoQuestion('Assisting evidence?', 'offenceAssistingSuicide')

    const steps = new YesNoOffenceSteps([
      { question: murder, offenceType: 'MURDER_MANSLAUGHTER' },
      { question: assisting, offenceType: 'ASSISTING_SUICIDE' },
    ]).getSteps()

    expect(steps).toHaveLength(3)
    expect(steps[0]).toBeInstanceOf(Step)
    expect((steps[0] as Step).questions).toEqual([murder, assisting])

    expect(steps[1]).toBeInstanceOf(OffenceEvidenceStep)
    expect((steps[1] as OffenceEvidenceStep).offenceType).toBe('MURDER_MANSLAUGHTER')
    expect((steps[2] as OffenceEvidenceStep).offenceType).toBe('ASSISTING_SUICIDE')
  })
})

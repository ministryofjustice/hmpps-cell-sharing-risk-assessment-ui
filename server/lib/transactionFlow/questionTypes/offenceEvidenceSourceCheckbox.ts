import CheckboxQuestion from './checkbox'
import YesNoQuestion from './yesNo'
import { CsraAssessment, EvidenceSource, OffenceType } from '../../../data/csraApiTypes'
import OtherOffenceInputQuestion from './otherOffenceInput'

export default class OffenceEvidenceSourceCheckboxQuestion extends CheckboxQuestion {
  constructor(
    question: YesNoQuestion,
    public offenceType: OffenceType,
  ) {
    super(question.question.replace(/^Is there( any)? evidence/, 'Where did you find evidence'), 'evidenceSources', [
      {
        text: 'PNC',
        hint: { text: 'Current and previous convictions' },
        value: `PNC`,
        removeIf: assessment => !assessment.pncChecked,
      },
      {
        text: 'Warrant',
        hint: { text: 'Current charge or offence' },
        value: `WARRANT`,
        removeIf: assessment => !assessment.warrantChecked,
      },
      {
        text: 'DPS',
        hint: { text: 'Current and historical adjudications' },
        value: `DPS`,
        removeIf: assessment => !assessment.dpsChecked,
      },
      {
        text: 'PER',
        hint: { text: 'Violent behaviours in prison, court or PECS custody' },
        value: `PER`,
        removeIf: assessment => !assessment.perChecked,
      },
      {
        text: 'Other',
        value: `OTHER`,
        conditional: new OtherOffenceInputQuestion('Evidence source', `otherSource`, offenceType),
      },
    ])
  }

  override mutateAssessment(assessment: CsraAssessment, formValues: FormValues): CsraAssessment {
    let mutatedAssessment = {
      ...assessment,
      offenceEvidence: assessment.offenceEvidence.map(e => {
        if (e.offence !== this.offenceType) {
          return e
        }

        return { ...e, sources: formValues[this.id] as EvidenceSource[] }
      }),
    }

    this.items.forEach(item => {
      if (((formValues[this.id] || []) as string[]).includes(item.value) && item.conditional) {
        mutatedAssessment = item.conditional.mutateAssessment(mutatedAssessment, formValues)
      }
    })

    return mutatedAssessment
  }

  private getEvidenceData(assessment: CsraAssessment) {
    return assessment.offenceEvidence?.find(e => e.offence === this.offenceType)
  }

  override getFormValues(assessment: CsraAssessment): FormValues {
    return {
      [this.id]: this.getEvidenceData(assessment)?.sources || [],
      ...Object.fromEntries(
        this.items.filter(i => i.conditional).flatMap(i => Object.entries(i.conditional.getFormValues(assessment))),
      ),
    }
  }

  override isComplete(assessment: CsraAssessment): boolean {
    return !!this.getEvidenceData(assessment)?.sources
  }
}

import CheckboxQuestion from './checkbox'
import YesNoQuestion from './yesNo'
import { CsraAssessmentStageAnswers, EvidenceSource, OffenceType } from '../../../data/csraApiTypes'
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
        removeIf: assessmentAnswers => !assessmentAnswers.pncChecked,
      },
      {
        text: 'Warrant',
        hint: { text: 'Current charge or offence' },
        value: `WARRANT`,
        removeIf: assessmentAnswers => !assessmentAnswers.warrantChecked,
      },
      {
        text: 'DPS',
        hint: { text: 'Current and historical adjudications' },
        value: `DPS`,
        removeIf: assessmentAnswers => !assessmentAnswers.dpsChecked,
      },
      {
        text: 'PER',
        hint: { text: 'Violent behaviours in prison, court or PECS custody' },
        value: `PER`,
        removeIf: assessmentAnswers => !assessmentAnswers.perChecked,
      },
      {
        text: 'Other',
        value: `OTHER`,
        conditional: new OtherOffenceInputQuestion('Evidence source', `otherSource`, offenceType),
      },
    ])
  }

  override mutateAssessmentAnswers(
    assessmentAnswers: CsraAssessmentStageAnswers,
    formValues: FormValues,
  ): CsraAssessmentStageAnswers {
    let mutatedAssessment = {
      ...assessmentAnswers,
      offenceEvidence: assessmentAnswers.offenceEvidence.map(e => {
        if (e.offence !== this.offenceType) {
          return e
        }

        const value: EvidenceSource[] =
          typeof formValues[this.id] === 'string'
            ? [formValues[this.id] as EvidenceSource]
            : (formValues[this.id] as EvidenceSource[])

        return { ...e, sources: value }
      }),
    }

    this.items.forEach(item => {
      if (((formValues[this.id] || []) as string[]).includes(item.value) && item.conditional) {
        mutatedAssessment = item.conditional.mutateAssessmentAnswers(mutatedAssessment, formValues)
      }
    })

    return mutatedAssessment
  }

  private getEvidenceData(assessmentAnswers: CsraAssessmentStageAnswers) {
    return assessmentAnswers.offenceEvidence?.find(e => e.offence === this.offenceType)
  }

  override getFormValues(assessmentAnswers: CsraAssessmentStageAnswers): FormValues {
    return {
      [this.id]: this.getEvidenceData(assessmentAnswers)?.sources || [],
      ...Object.fromEntries(
        this.items
          .filter(i => i.conditional)
          .flatMap(i => Object.entries(i.conditional.getFormValues(assessmentAnswers))),
      ),
    }
  }

  override isAnswered(assessmentAnswers: CsraAssessmentStageAnswers): boolean {
    return !!this.getEvidenceData(assessmentAnswers)?.sources
  }
}

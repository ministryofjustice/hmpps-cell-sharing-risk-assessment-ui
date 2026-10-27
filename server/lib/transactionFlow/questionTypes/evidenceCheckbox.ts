import CheckboxQuestion from './checkbox'
import { CsraAssessmentStageAnswers } from '../../../data/csraApiTypes'
import required from '../validations/required'

const evidenceSources: (Omit<CheckboxItem, 'value'> & {
  value: keyof PickByType<CsraAssessmentStageAnswers, boolean>
})[] = [
  { text: 'PNC', hint: { text: 'Current and previous convictions' }, value: 'pncChecked' },
  { text: 'Warrant', hint: { text: 'Current charge or offence' }, value: 'warrantChecked' },
  { text: 'DPS', hint: { text: 'Current and historical adjudications' }, value: 'dpsChecked' },
  { text: 'PER', hint: { text: 'Violent behaviours in prison, court or PECS custody' }, value: 'perChecked' },
]

export default class EvidenceCheckboxQuestion extends CheckboxQuestion {
  override readonly component = 'appEvidenceSources'

  override items: typeof evidenceSources = []

  readonly checkedSources: typeof evidenceSources

  constructor(provisionalAnswers?: CsraAssessmentStageAnswers) {
    super(
      provisionalAnswers
        ? 'Which remaining evidence sources have you checked?'
        : 'Which evidence sources have you checked?',
      'evidenceSources',
      [],
    )
    this.checkedSources = evidenceSources.filter(item => provisionalAnswers?.[item.value])
    this.items = evidenceSources.filter(item => !provisionalAnswers?.[item.value]).map(item => ({ ...item }))
  }

  override componentAttributes(
    validationErrors: Record<string, { text: string }> | undefined,
    values: FormValues | undefined,
    assessmentAnswers: CsraAssessmentStageAnswers,
  ) {
    return {
      checkedSources: this.checkedSources,
      checkboxes: this.items.length
        ? super.componentAttributes(validationErrors, values, assessmentAnswers)
        : undefined,
    }
  }

  override isComplete(assessmentAnswers: CsraAssessmentStageAnswers): boolean {
    return evidenceSources.every(item => assessmentAnswers[item.value])
  }

  override isAnswered(assessmentAnswers: CsraAssessmentStageAnswers): boolean {
    return evidenceSources.some(item => assessmentAnswers[item.value])
  }

  override mutateAssessmentAnswers(
    assessmentAnswers: CsraAssessmentStageAnswers,
    formValues: FormValues,
  ): CsraAssessmentStageAnswers {
    let mutatedAssessmentAnswers = { ...assessmentAnswers }

    this.checkedSources.forEach(item => {
      mutatedAssessmentAnswers[item.value] = true
    })

    this.items.forEach(item => {
      const checked = !!(formValues[this.id] as string[])?.includes(item.value)
      mutatedAssessmentAnswers[item.value] = checked

      if (checked && item.conditional) {
        mutatedAssessmentAnswers = item.conditional.mutateAssessmentAnswers(mutatedAssessmentAnswers, formValues)
      }
    })

    return mutatedAssessmentAnswers
  }

  override eraseAnswers(assessmentAnswers: CsraAssessmentStageAnswers): CsraAssessmentStageAnswers {
    let mutatedAssessmentAnswers = { ...assessmentAnswers }

    this.items.forEach(item => {
      mutatedAssessmentAnswers[item.value] = null

      if (item.conditional) {
        mutatedAssessmentAnswers = item.conditional.eraseAnswers(mutatedAssessmentAnswers)
      }
    })

    return mutatedAssessmentAnswers
  }

  override getFormValues(assessmentAnswers: CsraAssessmentStageAnswers) {
    const values = this.items
      .map(item => (assessmentAnswers[item.value as keyof CsraAssessmentStageAnswers] ? item.value : undefined))
      .filter(s => s)

    return { [this.id]: values }
  }

  override validations(): ValidationFunction[] {
    return this.checkedSources.length ? [] : [required('Select at least one evidence source you have checked')]
  }
}

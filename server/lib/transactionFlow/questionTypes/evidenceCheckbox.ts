import CheckboxQuestion from './checkbox'
import { CsraAssessment } from '../../../data/csraApiTypes'

export default class EvidenceCheckboxQuestion extends CheckboxQuestion {
  override items: (Omit<CheckboxItem, 'value'> & { value: keyof PickByType<CsraAssessment, boolean> })[] = [
    { text: 'PNC', hint: { text: 'Current and previous convictions' }, value: 'pncChecked' },
    { text: 'Warrant', hint: { text: 'Current charge or offence' }, value: 'warrantChecked' },
    { text: 'DPS', hint: { text: 'Current and historical adjudications' }, value: 'dpsChecked' },
    { text: 'PER', hint: { text: 'Violent behaviours in prison, court or PECS custody' }, value: 'perChecked' },
  ]

  constructor() {
    super('Which evidence sources have you checked?', 'evidenceSources', [])
  }

  override isComplete(assessment: CsraAssessment): boolean {
    return this.items.some(item => assessment[item.value])
  }

  override mutateAssessment(assessment: CsraAssessment, formValues: FormValues): CsraAssessment {
    let mutatedAssessment = { ...assessment }

    this.items.forEach(item => {
      const checked = !!(formValues[this.id] as string[])?.includes(item.value)
      mutatedAssessment[item.value] = checked

      if (checked && item.conditional) {
        mutatedAssessment = item.conditional.mutateAssessment(mutatedAssessment, formValues)
      }
    })

    return mutatedAssessment
  }

  override getFormValues(assessment: CsraAssessment) {
    const values = this.items
      .map(item => (assessment[item.value as keyof CsraAssessment] ? item.value : undefined))
      .filter(s => s)

    return { [this.id]: values }
  }
}

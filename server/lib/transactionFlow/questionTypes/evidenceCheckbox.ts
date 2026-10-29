import CheckboxQuestion from './checkbox'
import { CsraAssessmentStageAnswers } from '../../../data/csraApiTypes'
import required from '../validations/required'
import { QuestionContext } from './base'

export default class EvidenceCheckboxQuestion extends CheckboxQuestion {
  override items: (Omit<CheckboxItem, 'value'> & { value: keyof PickByType<CsraAssessmentStageAnswers, boolean> })[] = [
    { text: 'PNC', hint: { text: 'Current and previous convictions' }, value: 'pncChecked' },
    { text: 'Warrant', hint: { text: 'Current charge or offence' }, value: 'warrantChecked' },
    { text: 'DPS', hint: { text: 'Current and historical adjudications' }, value: 'dpsChecked' },
    { text: 'PER', hint: { text: 'Violent behaviours in prison, court or PECS custody' }, value: 'perChecked' },
  ]

  constructor() {
    super('Which evidence sources have you checked?', 'evidenceSources', [], 'appEvidenceSources')
  }

  override componentAttributes(
    validationErrors: Record<string, { text: string }> | undefined,
    values: FormValues | undefined,
    assessmentAnswers: CsraAssessmentStageAnswers,
    context?: QuestionContext,
  ): object {
    const attributes = super.componentAttributes(validationErrors, values, assessmentAnswers) as {
      fieldset: { legend: { text: string; classes: string } }
      items: CheckboxItem[]
    }

    if (!context?.provisionalRatingEntered) {
      return attributes
    }

    const checkedSources = this.items
      .filter(item => context.provisionalAnswers?.[item.value])
      .map(({ text, hint }) => ({ text, hint }))

    return {
      ...attributes,
      fieldset: {
        ...attributes.fieldset,
        legend: {
          ...attributes.fieldset.legend,
          text: 'Which remaining evidence sources have you checked?',
        },
      },
      items: attributes.items.filter(
        item => !context.provisionalAnswers?.[item.value as keyof CsraAssessmentStageAnswers],
      ),
      checkedSources,
    }
  }

  override isComplete(assessmentAnswers: CsraAssessmentStageAnswers): boolean {
    return this.items.every(item => assessmentAnswers[item.value])
  }

  override isAnswered(assessmentAnswers: CsraAssessmentStageAnswers): boolean {
    return this.items.some(item => assessmentAnswers[item.value])
  }

  override mutateAssessmentAnswers(
    assessmentAnswers: CsraAssessmentStageAnswers,
    formValues: FormValues,
    context?: QuestionContext,
  ): CsraAssessmentStageAnswers {
    let mutatedAssessmentAnswers = { ...assessmentAnswers }

    this.items.forEach(item => {
      if (context?.provisionalRatingEntered && context.provisionalAnswers?.[item.value]) {
        mutatedAssessmentAnswers[item.value] = true
        return
      }

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

  override validations(context?: QuestionContext): ValidationFunction[] {
    if (
      context?.provisionalRatingEntered &&
      context.assessmentAnswers &&
      this.items.every(item => context.assessmentAnswers[item.value] || context.provisionalAnswers?.[item.value])
    ) {
      return []
    }

    return [
      required(
        context?.provisionalRatingEntered
          ? 'Select at least one remaining evidence source you have checked'
          : 'Select at least one evidence source you have checked',
      ),
    ]
  }
}

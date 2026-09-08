import YesNoQuestion from './yesNo'
import { CsraAssessmentStageAnswers } from '../../../data/csraApiTypes'
import TextAreaQuestion from './textArea'

export default class YesNoWithDetailQuestion extends YesNoQuestion {
  constructor(
    question: string,
    booleanField: keyof PickByType<CsraAssessmentStageAnswers, boolean>,
    public detailField: keyof PickByType<CsraAssessmentStageAnswers, string>,
    hint?: string,
  ) {
    super(question, booleanField as keyof PickByType<CsraAssessmentStageAnswers, boolean>, hint)

    this.items[0] = { ...this.items[0], conditional: new TextAreaQuestion('Provide details of the risk', detailField) }
  }
}

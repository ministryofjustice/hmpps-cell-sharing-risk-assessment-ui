import YesNoQuestion, { YesNoQuestionOptions } from './yesNo'
import { CsraAssessmentStageAnswers } from '../../../data/csraApiTypes'
import TextAreaQuestion, { TextAreaValidationMessages } from './textArea'
import required from '../validations/required'

type YesNoWithDetailQuestionOptions = YesNoQuestionOptions & {
  detailValidationMessages?: TextAreaValidationMessages
  detailLabel?: string
}

export default class YesNoWithDetailQuestion extends YesNoQuestion {
  constructor(
    question: string,
    booleanField: keyof PickByType<CsraAssessmentStageAnswers, boolean>,
    public detailField: keyof PickByType<CsraAssessmentStageAnswers, string>,
    protected override readonly options: YesNoWithDetailQuestionOptions = {},
  ) {
    super(question, booleanField as keyof PickByType<CsraAssessmentStageAnswers, boolean>, options)

    this.items[0] = {
      ...this.items[0],
      conditional: new TextAreaQuestion(options.detailLabel ?? 'Provide details of the risk', detailField, {
        validationMessages: options.detailValidationMessages,
      }),
    }
  }

  override validations(): ValidationFunction[] {
    const message = this.options.validationMessages?.required
    return message === undefined ? super.validations() : [required(message)]
  }
}

import YesNoQuestion, { YesNoQuestionOptions } from './yesNo'
import BaseAnswersObject from '../baseAnswersObject'
import TextAreaQuestion, { TextAreaValidationMessages } from './textArea'
import required from '../validations/required'

type YesNoWithDetailQuestionOptions = YesNoQuestionOptions & {
  detailValidationMessages?: TextAreaValidationMessages
  detailLabel?: string
}

export default class YesNoWithDetailQuestion<
  AnswersObject extends BaseAnswersObject,
> extends YesNoQuestion<AnswersObject> {
  constructor(
    question: string,
    booleanField: keyof PickByType<AnswersObject, boolean> & string,
    public detailField: keyof PickByType<AnswersObject, string> & string,
    protected override readonly options: YesNoWithDetailQuestionOptions = {},
  ) {
    super(question, booleanField, options)

    this.items[0] = {
      ...this.items[0],
      conditional: new TextAreaQuestion<AnswersObject>(
        options.detailLabel ?? 'Provide details of the risk',
        detailField,
        {
          validationMessages: options.detailValidationMessages,
        },
      ),
    }
  }

  override validations(): ValidationFunction[] {
    const message = this.options.validationMessages?.required
    return message === undefined ? super.validations() : [required(message)]
  }
}

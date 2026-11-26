import BaseAnswersObject from './baseAnswersObject'
import Step from './step'

export function findNextAvailableStep<AnswersObject extends BaseAnswersObject>(
  answers: AnswersObject,
  steps: Step<AnswersObject>[],
  afterStepId = -1,
) {
  const stepId = steps.findIndex((step, index) => index > afterStepId && !step.removeIf(answers))
  return stepId < 0 ? null : { stepId, step: steps[stepId] }
}

export function findNextUnansweredStep<AnswersObject extends BaseAnswersObject>(
  answers: AnswersObject,
  steps: Step<AnswersObject>[],
  afterStepId = -1,
) {
  const stepId = steps.findIndex(
    (step, index) => index > afterStepId && !step.removeIf(answers) && !step.isAnswered(answers),
  )
  return stepId < 0 ? null : { stepId, step: steps[stepId] }
}

export function findPreviousStep<AnswersObject extends BaseAnswersObject>(
  answers: AnswersObject,
  steps: Step<AnswersObject>[],
  beforeStepId = steps.length,
  answeredOnly = false,
) {
  const stepId = steps.findLastIndex(
    (step, index) => index < beforeStepId && !step.removeIf(answers) && (!answeredOnly || step.isAnswered(answers)),
  )
  return stepId < 0 ? null : { stepId, step: steps[stepId] }
}

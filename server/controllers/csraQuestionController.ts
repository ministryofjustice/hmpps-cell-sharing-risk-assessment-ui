import { type RequestHandler } from 'express'

import { NotFound } from 'http-errors'
import type { Services } from '../services'
import flowConfig from '../lib/transactionFlow/config'
import { CsraAssessment } from '../data/csraApiTypes'
import CheckboxQuestion from '../lib/transactionFlow/questionTypes/checkbox'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

function findNextAvailableStep(assessment: CsraAssessment, section: Section, afterStepId = -1) {
  const nextAvailableStepId = section.steps.findIndex((step, i) => {
    return !(afterStepId >= i || step.removeIf?.(assessment))
  })

  return nextAvailableStepId >= 0
    ? {
        stepId: nextAvailableStepId,
        step: section.steps[nextAvailableStepId],
      }
    : null
}

function findNextIncompleteStep(assessment: CsraAssessment, section: Section, afterStepId = -1) {
  const nextIncompleteStepId = section.steps.findIndex((step, i) => {
    if (afterStepId >= i || step.removeIf?.(assessment)) {
      return false
    }

    return !step.isComplete(assessment)
  })

  return nextIncompleteStepId >= 0
    ? {
        stepId: nextIncompleteStepId,
        step: section.steps[nextIncompleteStepId],
      }
    : null
}

function getCurrentStep(assessment: CsraAssessment, sectionId: string, stepId: number) {
  const section = flowConfig[sectionId]

  const firstIncompleteStep = findNextIncompleteStep(assessment, section)
  let currentStepId = stepId
  if (currentStepId === undefined || Number.isNaN(currentStepId)) {
    currentStepId = firstIncompleteStep?.stepId || 0
  }

  if (firstIncompleteStep && firstIncompleteStep.stepId >= 0) {
    currentStepId = Math.min(currentStepId, firstIncompleteStep.stepId)
  }

  let currentStep = section.steps[currentStepId]
  if (!currentStep || currentStep.removeIf?.(assessment)) {
    currentStep = firstIncompleteStep?.step
    currentStepId = firstIncompleteStep?.stepId
  }

  return { currentStep, currentStepId }
}

export default function csraQuestionController({
  // auditService,
  csraService,
}: Dependencies): RequestHandler<{ prisonerNumber: string; assessmentId: string; sectionId: string; stepId?: string }> {
  return async (req, res, _next) => {
    const { assessmentId, sectionId } = req.params
    const { prisoner } = res.locals

    const section = flowConfig[sectionId]
    if (!section) {
      throw NotFound(`Invalid CSRA section: ${sectionId}`)
    }

    const assessment = await csraService.getCsraAssessment(res.locals.prisoner.prisonerNumber, assessmentId)
    if (!assessment) {
      throw NotFound(`No CSRA assessment found for ID: ${assessmentId}`)
    }

    const { currentStep, currentStepId } = getCurrentStep(assessment, sectionId, Number(req.params.stepId))

    if (!currentStep) {
      throw NotFound('Assessment step not found')
    }

    const values = currentStep.getFormValues(assessment)

    const assessmentUrl = `/prisoner/${prisoner.prisonerNumber}/csra/${assessmentId}`

    const validationErrors: Record<string, { text: string }> = {}
    if (req.method === 'POST') {
      // get values from step questions
      const fieldIds = currentStep.questions.flatMap(q => q.id)
      const newValues = Object.fromEntries(Object.entries(req.body).filter(([k]) => fieldIds.includes(k))) as Record<
        string,
        string | string[] | number | undefined
      >

      // Add conditional checkbox field values to newValues
      currentStep.questions.forEach(question => {
        if (question instanceof CheckboxQuestion) {
          const value = newValues[question.id]
          question.items.forEach(i => {
            if (((value || []) as string[]).includes(i.value) && i.conditional) {
              newValues[i.conditional.id] = req.body[i.conditional.id]
            }
          })
        }
      })

      // Validate each question and its conditional fields
      currentStep.questions.forEach(question => {
        const { id } = question
        const value = newValues[id]
        values[id] = value

        question.validations()?.some(validation => {
          const errorMessage = validation(value)

          if (errorMessage) {
            validationErrors[id] = { text: errorMessage }
            return true
          }

          return false
        })

        if (question instanceof CheckboxQuestion) {
          question.items.forEach(i => {
            if (((value || []) as string[]).includes(i.value) && i.conditional) {
              const conditionalValue = newValues[i.conditional.id]
              values[i.conditional.id] = conditionalValue

              i.conditional.validations()?.some(validation => {
                const errorMessage = validation(conditionalValue)

                if (errorMessage) {
                  validationErrors[i.conditional.id] = { text: errorMessage }
                  return true
                }

                return false
              })
            }
          })
        }
      })

      if (Object.keys(validationErrors).length === 0) {
        const newAssessment = await csraService.updateCsraAssessment(
          res.locals.prisoner.prisonerNumber,
          assessmentId,
          currentStep.mutateAssessment(assessment, newValues),
        )

        const nextStep = findNextAvailableStep(newAssessment, section, currentStepId)
        let nextStepUrl = assessmentUrl
        if (nextStep) {
          nextStepUrl += `/section/${sectionId}/${nextStep.stepId}`
        }
        res.redirect(nextStepUrl)

        return
      }
    }

    // await auditService.logPageView(Page.PRISONER_CSRA, {
    //   who: username,
    //   subjectId: prisonerNumber,
    //   subjectType: 'PRISONER_ID',
    //   correlationId: req.id,
    // })

    res.render('pages/csraQuestion', {
      title: currentStep.title ?? section.title,
      prisoner,
      section,
      currentStep,
      ...(Object.keys(validationErrors).length > 0 ? { validationErrors } : {}),
      values,
      assessment,
      cancelLink: assessmentUrl,
    })
  }
}

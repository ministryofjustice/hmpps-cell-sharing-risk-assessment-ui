import { Request, RequestHandler, Response } from 'express'
import { BadRequest, Conflict, NotFound } from 'http-errors'
import { CsraReview, CsraReviewAnswers, CsraReviewReason } from '../data/csraApiTypes'
import { availableReviewReasons, reasonQuestion, reviewSteps } from '../lib/transactionFlow/reviewConfig'
import { eraseRemovedSteps, validateStep } from '../lib/transactionFlow/stepSubmission'
import { findNextAvailableStep, findNextUnansweredStep, findPreviousStep } from '../lib/transactionFlow/stepNavigation'
import type { Services } from '../services'
import { Page } from '../services/auditService'
import { appendReferrers, referrerStack } from '../utils/breadcrumbOrigins'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

const isReason = (value: unknown): value is CsraReviewReason =>
  typeof value === 'string' && reasonQuestion.items.some(item => item.value === value)

function currentAnswers(review: CsraReview) {
  const final = review.stages.find(stage => stage.stage === 'FINAL')
  const interim = review.stages.find(stage => stage.stage === 'INTERIM')
  return { answers: final?.answers ?? interim?.answers, version: final?.version ?? 1 }
}

function reviewUrl(prisonerNumber: string, reviewId?: string) {
  return `/prisoner/${prisonerNumber}/review${reviewId ? `/${reviewId}` : ''}`
}

function reasonSessionKey(prisonerNumber: string, reviewId?: string) {
  return reviewId ? `${prisonerNumber}:${reviewId}` : prisonerNumber
}

export default function reviewQuestionController({ auditService, csraService }: Dependencies) {
  const render = async (req: Request, res: Response, options: object) => {
    await auditService.logPageView(Page.PRISONER_CSRA_REVIEW, {
      who: res.locals.user.username,
      subjectId: res.locals.prisoner.prisonerNumber,
      subjectType: 'PRISONER_NUMBER',
      correlationId: req.id,
    })
    res.render('pages/reviewQuestion', options)
  }

  const configuredStep = (persistence: 'stage-reason' | 'create') => {
    const configured = reviewSteps.find(item => item.persistence === persistence)
    if (!configured) throw new Error(`Missing review ${persistence} step`)
    return configured
  }

  const handleStep = async (req: Request, res: Response, path: string, reviewId?: string) => {
    const index = reviewSteps.findIndex(item => item.path === path)
    if (index < 0) throw NotFound('Review question not found')
    const { step, persistence } = reviewSteps[index]
    const steps = reviewSteps.map(item => item.step)
    const reasonStep = configuredStep('stage-reason')
    const { prisonerNumber } = res.locals.prisoner
    const { username } = res.locals.user
    const base = reviewUrl(prisonerNumber, reviewId)
    const prisonerUrl = `/prisoner/${prisonerNumber}`
    const refs = referrerStack(req.query.referrer)
    const sessionKey = reasonSessionKey(prisonerNumber, reviewId)
    const stagedReason = req.session.reviewReasons?.[sessionKey]
    let review: CsraReview
    let savedAnswers: CsraReviewAnswers
    let version: number
    if (reviewId) {
      review = await csraService.getReviewForEditing(username, prisonerNumber, reviewId)
      if (!review || review.prisonerNumber !== prisonerNumber) throw NotFound('Review not found')
      if (review.finalResult || review.status !== 'IN_PROGRESS') throw Conflict('Review cannot be edited')
      ;({ answers: savedAnswers, version } = currentAnswers(review))
    }

    let allowedReasons: CsraReviewReason[]
    if (persistence === 'stage-reason' || persistence === 'pending' || (persistence === 'create' && !savedAnswers)) {
      const rating = await csraService.getCurrentRating(username, prisonerNumber)
      allowedReasons = availableReviewReasons(rating)
      if (!allowedReasons.length) throw Conflict('A current rating is required to start a review')
    }

    if (persistence === 'stage-reason' && savedAnswers && review.interimResult) {
      throw Conflict('Review reason cannot be changed after an interim rating')
    }
    if (persistence === 'update' && !savedAnswers) {
      res.redirect(appendReferrers(`${base}/${reasonStep.path}`, refs))
      return
    }
    if (
      (persistence === 'pending' || (persistence === 'create' && !savedAnswers)) &&
      (!isReason(stagedReason) || !allowedReasons.includes(stagedReason))
    ) {
      res.redirect(appendReferrers(`${base}/${reasonStep.path}`, refs))
      return
    }

    let answers = savedAnswers
    if ((persistence === 'create' || persistence === 'pending') && isReason(stagedReason) && !review?.interimResult) {
      answers = { ...(answers ?? { evidenceSources: [] }), reviewReason: stagedReason }
    }
    if (persistence !== 'stage-reason' && step.removeIf(answers)) throw NotFound('Review question not found')

    const questionContext = {
      ...(allowedReasons ? { availableOptions: { reviewReason: allowedReasons } } : {}),
      headingQuestionIds: step.questions.filter(question => question.question).map(question => question.id),
    }
    let values =
      persistence === 'stage-reason'
        ? { reviewReason: stagedReason ?? savedAnswers?.reviewReason }
        : step.getFormValues(answers)
    let errors: Record<string, { text: string }> = {}
    if (req.method === 'POST') {
      const result = validateStep(step, req.body, values, questionContext, persistence === 'update')
      values = result.values
      errors = result.errors
      if (
        persistence === 'stage-reason' &&
        (!isReason(req.body.reviewReason) || !allowedReasons.includes(req.body.reviewReason))
      ) {
        errors.reviewReason = { text: 'Select the reason for review' }
      }
      if (!Object.keys(errors).length) {
        if (persistence === 'stage-reason') {
          if (!isReason(req.body.reviewReason)) throw BadRequest('Invalid review reason')
          req.session.reviewReasons = { ...req.session.reviewReasons, [sessionKey]: req.body.reviewReason }
          const nextAnswers = { ...(savedAnswers ?? { evidenceSources: [] }), reviewReason: req.body.reviewReason }
          const next = review
            ? findNextAvailableStep(
                nextAnswers,
                steps,
                reviewSteps.findIndex(item => item.persistence === 'create') - 1,
              )
            : findNextAvailableStep(nextAnswers, steps, index)
          res.redirect(appendReferrers(next ? `${base}/${reviewSteps[next.stepId].path}` : base, refs))
          return
        }

        const updated = eraseRemovedSteps(
          steps.slice(index + 1),
          step.mutateAssessmentAnswers(answers, result.newValues),
        )
        const prisonId = res.locals.feComponents?.sharedData?.activeCaseLoad?.caseLoadId
        if (!prisonId) throw BadRequest('Active caseload is required to save a review')
        let targetBase = base
        if (review) {
          if (String(version) !== req.body.version) throw Conflict('Review answers have changed; reload and try again')
          await csraService.updateReviewAnswers(username, prisonerNumber, review.reviewId, prisonId, version, updated)
        } else {
          if (persistence !== 'create') throw BadRequest('Review must be created before updating answers')
          const created = await csraService.startCsraReview(username, prisonerNumber, prisonId, updated)
          targetBase = reviewUrl(prisonerNumber, created.reviewId)
        }
        if (persistence === 'create') delete req.session.reviewReasons?.[sessionKey]
        const next = findNextAvailableStep(updated, steps, index)
        const shouldContinue = persistence === 'update' || !savedAnswers
        res.redirect(
          appendReferrers(shouldContinue && next ? `${targetBase}/${reviewSteps[next.stepId].path}` : targetBase, refs),
        )
        return
      }
    }

    const previous = answers && findPreviousStep(answers, steps, index)
    const previousPath = previous && reviewSteps[previous.stepId].path
    let backLink = review ? base : prisonerUrl
    if (persistence === 'stage-reason') {
      backLink = savedAnswers ? base : prisonerUrl
    } else if (previousPath && !(review?.interimResult && previousPath === reasonStep.path)) {
      backLink = `${base}/${previousPath}`
    }
    await render(req, res, {
      title: step.title ?? 'Review questions',
      kind: persistence === 'pending' ? 'pending' : undefined,
      reviewStarted: !!review,
      currentStep: step,
      assessmentAnswers: answers ?? savedAnswers ?? {},
      values,
      questionContext,
      reviewQuestionHeadings: step.questions.length > 0 && persistence !== 'pending',
      saveButtonText: persistence === 'stage-reason' ? 'Continue' : 'Save and continue',
      version,
      includeVersion: persistence !== 'stage-reason',
      validationErrors: Object.keys(errors).length ? errors : undefined,
      backLink: appendReferrers(backLink, refs),
      cancelLink: appendReferrers(
        review && (persistence !== 'stage-reason' || savedAnswers) ? base : prisonerUrl,
        refs,
      ),
      referrers: refs,
    })
  }

  const question =
    (path: string): RequestHandler<{ reviewId?: string }> =>
    (req, res) =>
      handleStep(req, res, path, req.params.reviewId)

  const overview: RequestHandler<{ reviewId: string }> = async (req, res) => {
    const { prisonerNumber } = res.locals.prisoner
    const review = await csraService.getReviewForEditing(res.locals.user.username, prisonerNumber, req.params.reviewId)
    if (!review || review.prisonerNumber !== prisonerNumber) throw NotFound('Review not found')
    if (review.finalResult || review.status !== 'IN_PROGRESS') throw Conflict('Review cannot be edited')
    const { answers } = currentAnswers(review)
    const base = reviewUrl(prisonerNumber, req.params.reviewId)
    const refs = referrerStack(req.query.referrer)
    const reasonStep = configuredStep('stage-reason')
    const evidenceStep = configuredStep('create')
    if (!answers) {
      res.redirect(appendReferrers(`${base}/${reasonStep.path}`, refs))
      return
    }
    delete req.session.reviewReasons?.[reasonSessionKey(prisonerNumber, req.params.reviewId)]
    const questions = reviewSteps.filter(item => item.persistence === 'update')
    const firstUnanswered = findNextUnansweredStep(
      answers,
      questions.map(item => item.step),
    )
    await render(req, res, {
      title: 'Review in progress',
      kind: 'overview',
      questions: questions.flatMap(({ step, path }) =>
        step.removeIf(answers)
          ? []
          : [
              {
                text: step.title ?? step.questions.map(item => item.question).join(', '),
                href: appendReferrers(`${base}/${path}`, refs),
              },
            ],
      ),
      hasQuestions: questions.length > 0,
      evidenceLink: appendReferrers(`${base}/${evidenceStep.path}`, refs),
      reasonText: reasonQuestion.items.find(item => item.value === answers.reviewReason)?.text,
      reasonLink: review.interimResult ? undefined : appendReferrers(`${base}/${reasonStep.path}`, refs),
      continueLink: firstUnanswered
        ? appendReferrers(`${base}/${questions[firstUnanswered.stepId].path}`, refs)
        : undefined,
      backLink: appendReferrers(`/prisoner/${prisonerNumber}`, refs),
      cancelLink: appendReferrers(`/prisoner/${prisonerNumber}`, refs),
      referrers: refs,
    })
  }

  return { question, overview }
}

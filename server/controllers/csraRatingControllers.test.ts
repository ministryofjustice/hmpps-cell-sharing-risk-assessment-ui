import type { Request, Response } from 'express'
import CsraService from '../services/csraService'
import AuditService, { Page } from '../services/auditService'
import { AssessmentSubmitType, getAssessmentSubmitStatus } from '../utils/getAssessmentSubmitStatus'
import type { CsraAssessment } from '../data/csraApiTypes'
import CsraSelectRatingController from './csraSelectRatingController'
import CsraConfirmRatingController from './csraConfirmRatingController'

jest.mock('../services/csraService')
jest.mock('../services/auditService')
jest.mock('../utils/getAssessmentSubmitStatus')

const assessment: CsraAssessment = {
  assessmentId: 'assessment-123',
  prisonerNumber: 'A1234BC',
  status: 'IN_PROGRESS',
  startedBy: 'USER1',
  startedAt: '2026-05-01T10:00:00Z',
  stages: [
    {
      stage: 'PROVISIONAL',
      prisonId: 'LEI',
      offenceEvidence: [],
      riskTo: [],
      vulnerabilities: [],
      version: 1,
    },
  ],
}

describe('CSRA rating controllers', () => {
  const csraService = jest.mocked(new CsraService(null))
  const auditService = jest.mocked(new AuditService(null))
  const dependencies = { csraService, auditService }
  const assessmentUrl = '/prisoner/A1234BC/csra/assessment-123'
  const submitStatus = jest.mocked(getAssessmentSubmitStatus)

  const request = (method = 'GET', body: Record<string, unknown> = {}, rating = 'HIGH_GENERAL') =>
    ({
      method,
      id: 'request-123',
      params: { prisonerNumber: 'A1234BC', assessmentId: 'assessment-123', rating },
      query: {},
      body,
      flash: jest.fn(),
    }) as unknown as Request<{ prisonerNumber: string; assessmentId: string; rating: string }>

  const response = () =>
    ({
      locals: {
        user: { username: 'user1' },
        prisoner: { prisonerNumber: 'A1234BC', firstName: ' JOHN ' },
      },
      render: jest.fn(),
      redirect: jest.fn(),
    }) as unknown as Response

  beforeEach(() => {
    jest.clearAllMocks()
    csraService.getCsraAssessment.mockResolvedValue(assessment)
    csraService.getCurrentRating.mockResolvedValue({
      prisonerNumber: 'A1234BC',
      status: 'NO_RATING',
      rating: null,
      provisional: false,
      riskTo: [],
      vulnerabilities: [],
    })
    submitStatus.mockReturnValue({
      submitType: AssessmentSubmitType.FINAL,
      remainingTasks: [],
      allowedRatings: ['HIGH_GENERAL', 'HIGH_SPECIFIC', 'STANDARD'],
    })
  })

  describe('selection', () => {
    const controller = new CsraSelectRatingController(dependencies)

    it('loads assessment context and audits the rendered selection page', async () => {
      const req = request()
      req.query.selectedRating = 'HIGH_SPECIFIC'
      const res = response()

      await controller.requestHandler()(req, res, jest.fn())

      expect(csraService.getCsraAssessment).toHaveBeenCalledWith('user1', 'A1234BC', 'assessment-123')
      expect(csraService.getCurrentRating).toHaveBeenCalledWith('user1', 'A1234BC')
      expect(res.render).toHaveBeenCalledWith(
        'pages/csraSelectRating',
        expect.objectContaining({
          selectedRating: 'HIGH_SPECIFIC',
          assessment,
          assessmentAnswers: assessment.stages[0],
          assessmentUrl,
          prisonerLink: '/prisoner/A1234BC',
          cancelLink: assessmentUrl,
          isProvisional: false,
          isHighGeneral: false,
        }),
      )
      expect(auditService.logPageView).toHaveBeenCalledWith(Page.PRISONER_CSRA_SELECT_RATING, {
        who: 'user1',
        subjectId: 'assessment-123',
        subjectType: 'ASSESSMENT_ID',
        correlationId: 'request-123',
      })
    })

    it('uses the submitted rating rather than a stale query parameter', async () => {
      const req = request('POST', { selectedRating: 'STANDARD' })
      req.query.selectedRating = 'HIGH_SPECIFIC'
      const res = response()

      await controller.requestHandler()(req, res, jest.fn())

      expect(res.redirect).toHaveBeenCalledWith(`${assessmentUrl}/confirm-rating/STANDARD`)
      expect(req.body.selectedRating).toBe('STANDARD')
    })

    it.each([undefined, 'UNSUPPORTED', ['HIGH_GENERAL'], { rating: 'HIGH_GENERAL' }])(
      'rejects invalid selection %j without redirecting',
      async selectedRating => {
        const res = response()

        await controller.requestHandler()(request('POST', { selectedRating }), res, jest.fn())

        expect(res.locals.validationErrors).toEqual({ selectedRating: { text: 'Select a CSRA rating' } })
        expect(res.render).toHaveBeenCalled()
        expect(res.redirect).not.toHaveBeenCalled()
      },
    )

    it('rejects a disallowed rating without replacing the user input with high-general', async () => {
      submitStatus.mockReturnValue({
        submitType: AssessmentSubmitType.PROVISIONAL,
        remainingTasks: ['See healthcare'],
        allowedRatings: ['HIGH_GENERAL'],
      })
      const req = request('POST', { selectedRating: 'HIGH_SPECIFIC' })
      const res = response()

      await controller.requestHandler()(req, res, jest.fn())

      expect(req.body.selectedRating).toBe('HIGH_SPECIFIC')
      expect(res.locals.selectedRating).toBe('HIGH_SPECIFIC')
      expect(res.locals.isProvisional).toBe(true)
      expect(res.redirect).not.toHaveBeenCalled()
      expect(res.locals.validationErrors.selectedRating).toEqual({ text: 'Select a CSRA rating' })
    })

    it('redirects unavailable assessments before loading a current rating or auditing', async () => {
      submitStatus.mockReturnValue({ submitType: AssessmentSubmitType.NONE, remainingTasks: [], allowedRatings: [] })
      const res = response()

      await controller.requestHandler()(request(), res, jest.fn())

      expect(res.redirect).toHaveBeenCalledWith(assessmentUrl)
      expect(csraService.getCurrentRating).not.toHaveBeenCalled()
      expect(auditService.logPageView).not.toHaveBeenCalled()
      expect(res.render).not.toHaveBeenCalled()
    })

    it('raises not found for a missing assessment', async () => {
      csraService.getCsraAssessment.mockResolvedValue(null)
      const res = response()

      await expect(controller.requestHandler()(request(), res, jest.fn())).rejects.toMatchObject({
        status: 404,
        message: 'No CSRA assessment found for ID: assessment-123',
      })

      expect(res.render).not.toHaveBeenCalled()
    })
  })

  describe('confirmation', () => {
    const controller = new CsraConfirmRatingController(dependencies)

    it.each([
      [AssessmentSubmitType.PROVISIONAL, 'HIGH_GENERAL', 'high risk – general (provisional)'],
      [AssessmentSubmitType.PROVISIONAL, 'HIGH_SPECIFIC', 'high risk – specific (provisional)'],
      [AssessmentSubmitType.FINAL, 'HIGH_GENERAL', 'high risk – general'],
      [AssessmentSubmitType.FINAL, 'HIGH_SPECIFIC', 'high risk – specific'],
      [AssessmentSubmitType.FINAL, 'STANDARD', 'standard'],
    ])('submits %s %s and flashes the correct stage-aware label', async (submitType, rating, label) => {
      submitStatus.mockReturnValue({ submitType, remainingTasks: [], allowedRatings: [rating] })
      const req = request(
        'POST',
        {
          assessmentComment: 'Recorded evidence',
          ...(rating === 'HIGH_GENERAL' ? { nextReviewDate: '17/5/2099' } : {}),
        },
        rating,
      )
      const res = response()

      await controller.requestHandler()(req, res, jest.fn())

      const payload = { ...assessment.stages[0], rating, assessmentComment: 'Recorded evidence' }
      if (submitType === AssessmentSubmitType.FINAL) {
        expect(csraService.submitFinalRating).toHaveBeenCalledWith('user1', 'A1234BC', 'assessment-123', {
          ...payload,
          nextReviewDate: rating === 'HIGH_GENERAL' ? '2099-05-17' : undefined,
        })
        expect(csraService.submitProvisionalRating).not.toHaveBeenCalled()
      } else {
        expect(csraService.submitProvisionalRating).toHaveBeenCalledWith('user1', 'A1234BC', 'assessment-123', payload)
        expect(csraService.submitFinalRating).not.toHaveBeenCalled()
      }
      expect(req.flash).toHaveBeenCalledWith('success', {
        title: 'CSRA rating confirmed',
        content: `John’s CSRA rating has been confirmed as ${label}.`,
      })
      expect(res.redirect).toHaveBeenCalledWith('/prisoner/A1234BC')
    })

    it('audits confirmation and provides a back link retaining the selected rating', async () => {
      const res = response()

      await controller.requestHandler()(request(), res, jest.fn())

      expect(res.render).toHaveBeenCalledWith(
        'pages/csraConfirmRating',
        expect.objectContaining({ backLink: `${assessmentUrl}/select-rating?selectedRating=HIGH_GENERAL` }),
      )
      expect(auditService.logPageView).toHaveBeenCalledWith(
        Page.PRISONER_CSRA_CONFIRM_RATING,
        expect.objectContaining({ subjectId: 'assessment-123', correlationId: 'request-123' }),
      )
    })

    it.each([
      [AssessmentSubmitType.FINAL, 'STANDARD'],
      [AssessmentSubmitType.PROVISIONAL, 'HIGH_SPECIFIC'],
    ])('does not flash success or redirect when %s submission fails', async (submitType, rating) => {
      submitStatus.mockReturnValue({ submitType, remainingTasks: [], allowedRatings: [rating] })
      const error = new Error('API unavailable')
      const submit =
        submitType === AssessmentSubmitType.FINAL ? csraService.submitFinalRating : csraService.submitProvisionalRating
      submit.mockRejectedValueOnce(error)
      const req = request('POST', { assessmentComment: 'Recorded evidence' }, rating)
      const res = response()

      await expect(controller.requestHandler()(req, res, jest.fn())).rejects.toThrow(error)

      expect(req.flash).not.toHaveBeenCalled()
      expect(res.redirect).not.toHaveBeenCalled()
    })
  })
})

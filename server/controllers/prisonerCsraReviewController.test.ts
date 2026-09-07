import type { NextFunction, Request, Response } from 'express'
import PrisonerCsraReviewController from './prisonerCsraReviewController'
import { Page } from '../services/auditService'
import type { CsraReviewDetail } from '../data/csraApiTypes'

const REVIEW_ID = 'de91dfa7-821f-4552-a427-bf2f32eafeb0'

const review = (overrides: Partial<CsraReviewDetail> = {}): CsraReviewDetail => ({
  id: REVIEW_ID,
  prisonerNumber: 'A1234BC',
  prisonId: 'LEI',
  prisonName: 'Leeds (HMP)',
  assessmentDate: '2016-10-31',
  type: 'REVIEW',
  createdAt: '2016-10-31T09:15:00',
  createdBy: 'NQP56Y',
  ...overrides,
})

const auditService = { logPageView: jest.fn().mockResolvedValue(null) }
const csraService = { getReview: jest.fn() }

const controller = () => new PrisonerCsraReviewController({ auditService, csraService } as never)

type ReviewRequest = Request<{ prisonerNumber: string; reviewId: string }>

const request = (reviewId = REVIEW_ID, prisonerNumber = 'A1234BC') =>
  ({ params: { prisonerNumber, reviewId }, id: 'request-id-123' }) as unknown as ReviewRequest

const response = () =>
  ({
    locals: { user: { username: 'user1' }, prisoner: { prisonerNumber: 'A1234BC' } },
    render: jest.fn(),
  }) as unknown as Response

beforeEach(() => jest.clearAllMocks())

describe('PrisonerCsraReviewController', () => {
  it('renders a legacy review with its questions and audits the page view', async () => {
    csraService.getReview.mockResolvedValue(
      review({
        legacy: {
          approvedResult: 'HI',
          questions: [
            { question: 'Select Risk Rating', answer: 'High', additionalAnswers: [] },
            { question: 'Not answered', answer: null, additionalAnswers: [] },
          ],
        },
      }),
    )
    const res = response()

    await controller().index(request(), res, jest.fn())

    expect(csraService.getReview).toHaveBeenCalledWith('user1', REVIEW_ID)
    expect(res.render).toHaveBeenCalledWith(
      'pages/prisonerCsraReview',
      expect.objectContaining({
        prisonerNumber: 'A1234BC',
        isLegacy: true,
        questions: [{ question: 'Select Risk Rating', answers: ['High'] }],
      }),
    )
    expect(auditService.logPageView).toHaveBeenCalledWith(Page.PRISONER_CSRA_REVIEW, {
      who: 'user1',
      subjectId: 'A1234BC',
      subjectType: 'PRISONER_ID',
      correlationId: 'request-id-123',
      details: { reviewId: REVIEW_ID },
    })
  })

  it('renders a DPS-created review with no questions', async () => {
    csraService.getReview.mockResolvedValue(review({ type: 'CSRA_INITIAL_REVIEW' }))
    const res = response()

    await controller().index(request(), res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/prisonerCsraReview',
      expect.objectContaining({ isLegacy: false, questions: [] }),
    )
  })

  it('404s a review id that is not a UUID, without calling the API', async () => {
    const next = jest.fn() as NextFunction

    await controller().index(request('not-a-uuid'), response(), next)

    expect(csraService.getReview).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }))
  })

  it('404s when the API does not know the review', async () => {
    // The rest client names it responseStatus, not status.
    csraService.getReview.mockRejectedValue({ responseStatus: 404 })
    const next = jest.fn() as NextFunction

    await controller().index(request(), response(), next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }))
  })

  it('404s a review belonging to a different prisoner, and does not audit it', async () => {
    // GET /csra-review/{id} is not prisoner-scoped, so this is what stops someone reading any review
    // by pasting its id under a prisoner they do have access to.
    csraService.getReview.mockResolvedValue(review({ prisonerNumber: 'Z9999ZZ' }))
    const res = response()
    const next = jest.fn() as NextFunction

    await controller().index(request(), res, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }))
    expect(res.render).not.toHaveBeenCalled()
    expect(auditService.logPageView).not.toHaveBeenCalled()
  })

  it('passes any other API failure on to the error handler', async () => {
    const error = { responseStatus: 500 }
    csraService.getReview.mockRejectedValue(error)
    const next = jest.fn() as NextFunction

    await controller().index(request(), response(), next)

    expect(next).toHaveBeenCalledWith(error)
  })
})

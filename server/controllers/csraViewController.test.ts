import type { CsraAssessment, CsraDetailedRating } from '../data/csraApiTypes'
import csraViewController from './csraViewController'

const ASSESSMENT_ID = 'assessment-123'

const assessment: CsraAssessment = {
  assessmentId: ASSESSMENT_ID,
  prisonerNumber: 'A1234BC',
  status: 'COMPLETE',
  startedBy: 'USER1',
  startedAt: '2026-09-07T10:00:00Z',
  stages: [
    {
      stage: 'FINAL',
      prisonId: 'MDI',
      offenceEvidence: [],
      riskTo: [],
      vulnerabilities: [],
      version: 1,
    },
  ],
}

const detailedRating = {
  prisonerNumber: 'A1234BC',
  status: 'COMPLETE',
  rating: 'HIGH_SPECIFIC',
  provisional: false,
  finalCompletedBy: 'USER2',
  riskTo: [],
  vulnerabilities: [],
} as CsraDetailedRating

const notFound = () =>
  Object.assign(new Error('not found'), { responseStatus: 404, data: { errorCode: 'CsraReviewNotFound' } })

describe('csraViewController', () => {
  const csraService = {
    getCsraAssessment: jest.fn(),
    getDetailedCsraRating: jest.fn(),
  }

  const auditService = {
    logPageView: jest.fn().mockResolvedValue(null),
  }

  const manageUsersService = {
    getUserDetails: jest.fn().mockResolvedValue({ name: 'Jane Doe' }),
  }

  const controller = () => csraViewController({ auditService, csraService, manageUsersService } as never)

  const request = (referrer?: string | string[]) =>
    ({
      id: 'request-id-123',
      params: { prisonerNumber: 'A1234BC', assessmentId: ASSESSMENT_ID },
      query: referrer === undefined ? {} : { referrer },
    }) as any

  const response = () =>
    ({
      locals: {
        user: { username: 'user1' },
        prisoner: { prisonerNumber: 'A1234BC', firstName: 'JOHN', lastName: 'SMITH' },
      },
      render: jest.fn(),
    }) as any

  beforeEach(() => {
    jest.clearAllMocks()
    csraService.getCsraAssessment.mockResolvedValue(assessment)
    csraService.getDetailedCsraRating.mockResolvedValue(detailedRating)
    manageUsersService.getUserDetails.mockResolvedValue({ name: 'Jane Doe' })
  })

  it('renders the rating and the assessment answers, audits the view and resolves the completed-by name', async () => {
    const res = response()

    await controller()(request(), res, jest.fn())

    expect(csraService.getCsraAssessment).toHaveBeenCalledWith('user1', 'A1234BC', ASSESSMENT_ID)
    expect(csraService.getDetailedCsraRating).toHaveBeenCalledWith('user1', ASSESSMENT_ID)
    expect(manageUsersService.getUserDetails).toHaveBeenCalledWith('user1', 'USER2')
    expect(auditService.logPageView).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ who: 'user1', subjectId: 'A1234BC', correlationId: 'request-id-123' }),
    )
    expect(res.render).toHaveBeenCalledWith(
      'pages/csraView',
      expect.objectContaining({
        assessment,
        assessmentAnswers: expect.objectContaining({ stage: 'PROVISIONAL' }),
        detailedRating,
        backLink: '/prisoner/A1234BC',
        backLinkText: 'Back to CSRA overview',
      }),
    )
  })

  it('backs out to the history page without the history entry, keeping the origin, when reached from history', async () => {
    const res = response()

    await controller()(request(['due-for-review', 'history']), res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/csraView',
      expect.objectContaining({
        backLink: '/prisoner/A1234BC/history?referrer=due-for-review',
        backLinkText: 'Back to CSRA history',
      }),
    )
  })

  it('backs out to the history page with no query string when history is the only referrer', async () => {
    const res = response()

    await controller()(request(['history']), res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/csraView',
      expect.objectContaining({ backLink: '/prisoner/A1234BC/history', backLinkText: 'Back to CSRA history' }),
    )
  })

  it('keeps the worklist origin on the overview back link', async () => {
    const res = response()

    await controller()(request(['due-for-review']), res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/csraView',
      expect.objectContaining({
        backLink: '/prisoner/A1234BC?referrer=due-for-review',
        backLinkText: 'Back to CSRA overview',
      }),
    )
  })

  it('renders the rating without the answers when the assessment has been removed', async () => {
    csraService.getCsraAssessment.mockRejectedValue(notFound())
    const res = response()

    await controller()(request(), res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/csraView',
      expect.objectContaining({
        assessment: undefined,
        assessmentAnswers: undefined,
        detailedRating,
      }),
    )
  })

  it('rethrows assessment errors other than the not-found response', async () => {
    csraService.getCsraAssessment.mockRejectedValue(Object.assign(new Error('boom'), { responseStatus: 500 }))

    await expect(controller()(request(), response(), jest.fn())).rejects.toThrow('boom')
    expect(auditService.logPageView).not.toHaveBeenCalled()
  })

  it('returns 404 and renders nothing when the rating belongs to a different prisoner', async () => {
    csraService.getDetailedCsraRating.mockResolvedValue({ ...detailedRating, prisonerNumber: 'B9999ZZ' })
    const res = response()

    await expect(controller()(request(), res, jest.fn())).rejects.toMatchObject({ status: 404 })
    expect(res.render).not.toHaveBeenCalled()
    expect(auditService.logPageView).not.toHaveBeenCalled()
  })

  it('does not look up a completed-by name when the rating has none', async () => {
    csraService.getDetailedCsraRating.mockResolvedValue({
      ...detailedRating,
      finalCompletedBy: undefined,
      provisionalCompletedBy: undefined,
    })

    await controller()(request(), response(), jest.fn())

    expect(manageUsersService.getUserDetails).not.toHaveBeenCalled()
  })
})

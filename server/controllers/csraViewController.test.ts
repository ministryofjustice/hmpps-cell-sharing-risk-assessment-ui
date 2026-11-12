import type { CsraDetailedRating } from '../data/csraApiTypes'
import csraViewController from './csraViewController'

const ASSESSMENT_ID = 'assessment-123'

const detailedRating: CsraDetailedRating = {
  prisonerNumber: 'A1234BC',
  status: 'COMPLETE',
  provisional: false,
  finalRating: 'HIGH_SPECIFIC',
  finalCompletedBy: 'USER2',
  riskTo: [],
  vulnerabilities: [],
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

const notFound = () =>
  Object.assign(new Error('not found'), { responseStatus: 404, data: { errorCode: 'CsraReviewNotFound' } })

describe('csraViewController', () => {
  const csraService = {
    getDetailedRating: jest.fn(),
  }

  const changeSomeonesCellService = {
    getCellSharingHistory: jest.fn().mockResolvedValue({ cells: [] }),
  }

  const auditService = {
    logPageView: jest.fn().mockResolvedValue(null),
  }

  const manageUsersService = {
    getUserDetails: jest.fn().mockResolvedValue({ name: 'Jane Doe' }),
  }

  const controller = () =>
    csraViewController({ auditService, changeSomeonesCellService, csraService, manageUsersService } as never)

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
    csraService.getDetailedRating.mockResolvedValue(detailedRating)
    manageUsersService.getUserDetails.mockResolvedValue({ name: 'Jane Doe' })
  })

  it('renders the rating and the assessment answers, audits the view and resolves the completed-by name', async () => {
    const res = response()

    await controller()(request(), res, jest.fn())

    expect(csraService.getDetailedRating).toHaveBeenCalledWith('user1', ASSESSMENT_ID)
    expect(manageUsersService.getUserDetails).toHaveBeenCalledWith('user1', 'USER2')
    expect(auditService.logPageView).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ who: 'user1', subjectId: 'A1234BC', correlationId: 'request-id-123' }),
    )
    expect(res.render).toHaveBeenCalledWith(
      'pages/csraView',
      expect.objectContaining({
        finalAssessmentAnswers: expect.objectContaining({ stage: 'FINAL' }),
        provisionalAssessmentAnswers: undefined,
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

  it('renders the rating without the answers when it has no assessment stages', async () => {
    const ratingWithoutStages: CsraDetailedRating = { ...detailedRating, stages: [] }
    csraService.getDetailedRating.mockResolvedValue(ratingWithoutStages)
    const res = response()

    await controller()(request(), res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/csraView',
      expect.objectContaining({
        finalAssessmentAnswers: undefined,
        provisionalAssessmentAnswers: undefined,
        detailedRating: ratingWithoutStages,
      }),
    )
  })

  it('returns not found when the rating does not exist', async () => {
    csraService.getDetailedRating.mockRejectedValue(notFound())

    await expect(controller()(request(), response(), jest.fn())).rejects.toMatchObject({ status: 404 })
    expect(auditService.logPageView).not.toHaveBeenCalled()
  })

  it('rethrows rating errors other than not found', async () => {
    csraService.getDetailedRating.mockRejectedValue(Object.assign(new Error('boom'), { responseStatus: 500 }))

    await expect(controller()(request(), response(), jest.fn())).rejects.toThrow('boom')
    expect(auditService.logPageView).not.toHaveBeenCalled()
  })

  it('returns 404 and renders nothing when the rating belongs to a different prisoner', async () => {
    csraService.getDetailedRating.mockResolvedValue({ ...detailedRating, prisonerNumber: 'B9999ZZ' })
    const res = response()

    await expect(controller()(request(), res, jest.fn())).rejects.toMatchObject({ status: 404 })
    expect(res.render).not.toHaveBeenCalled()
    expect(auditService.logPageView).not.toHaveBeenCalled()
  })

  it('does not look up a completed-by name when the rating has none', async () => {
    csraService.getDetailedRating.mockResolvedValue({
      ...detailedRating,
      finalCompletedBy: undefined,
      provisionalCompletedBy: undefined,
    })

    await controller()(request(), response(), jest.fn())

    expect(manageUsersService.getUserDetails).not.toHaveBeenCalled()
  })

  it('renders legacy details when the rating has no stages', async () => {
    csraService.getDetailedRating.mockResolvedValue({
      ...detailedRating,
      stages: [],
      startedBy: 'LEGACY_USER',
      legacy: {
        level: 'HI',
        approvalStatus: 'APPROVED',
        calculatedResult: 'MED',
        overrideResult: null,
        approvedResult: 'HI',
        assessmentComment: 'Legacy assessment comment',
        approvalCommitteeComment: 'Approval comment',
        approvalComment: null,
        approvalDate: '2026-09-07',
        assessmentCommittee: { code: 'GOV', name: 'Assessment committee' },
        approvalCommittee: { code: 'MED', name: 'Approval committee' },
        nextReviewDate: '2026-10-07',
        questions: [{ question: 'Legacy question', answer: 'Yes', additionalAnswers: [] }],
      },
    })

    const res = response()
    await controller()(request(), res, jest.fn())

    expect(manageUsersService.getUserDetails).toHaveBeenCalledWith('user1', 'LEGACY_USER')
    expect(res.render).toHaveBeenCalledWith(
      'pages/csraView',
      expect.objectContaining({
        legacySummaryRows: expect.arrayContaining([
          { key: { text: 'Assessment comments' }, value: { text: 'Legacy assessment comment' } },
          { key: { text: 'Assessed by' }, value: { text: 'Assessment committee - Jane Doe' } },
        ]),
        legacyQuestionsRows: [{ key: { text: 'Legacy question' }, value: { text: 'Yes' } }],
      }),
    )
  })

  it('loads cell sharing history for a provisional high-specific rating', async () => {
    const provisionalRating: CsraDetailedRating = {
      ...detailedRating,
      provisional: true,
      provisionalRating: 'HIGH_SPECIFIC',
      provisionalDate: '2026-09-07',
      provisionalTime: '10:30:00',
      stages: [
        {
          stage: 'PROVISIONAL',
          prisonId: 'MDI',
          offenceEvidence: [],
          riskTo: [],
          vulnerabilities: [],
          version: 1,
        },
      ],
    }
    changeSomeonesCellService.getCellSharingHistory.mockResolvedValue({
      cells: [
        {
          prisonId: 'MDI',
          locationKey: 'MDI-1-1-001',
          pathHierarchy: '1-1-001',
          nomisLocationId: 123,
          movedIn: '2026-09-01T10:00:00Z',
          sharedWith: [
            {
              prisonerNumber: 'B1234CD',
              firstName: 'JANE',
              lastName: 'DOE',
              sharedFrom: '2026-09-02T10:00:00Z',
            },
          ],
        },
      ],
    })
    csraService.getDetailedRating.mockResolvedValue(provisionalRating)
    const res = response()

    await controller()(request(), res, jest.fn())

    expect(changeSomeonesCellService.getCellSharingHistory).toHaveBeenCalledWith('user1', {
      prisonerNumber: 'A1234BC',
      from: '2026-09-07T10:30:00',
      to: expect.any(String), // The to date is the current date/time, so we can't assert the exact value
    })
    expect(res.render).toHaveBeenCalledWith(
      'pages/csraView',
      expect.objectContaining({
        cellSharingHistory: [
          [
            { text: '1-1-001' },
            { text: 'Jane Doe' },
            {
              html: expect.stringContaining('location-history?agencyId=MDI&locationId=123'),
            },
          ],
        ],
      }),
    )
  })
})

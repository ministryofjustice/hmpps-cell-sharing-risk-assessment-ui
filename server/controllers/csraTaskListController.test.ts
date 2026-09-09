import { CsraAssessment, CsraAssessmentStageAnswers } from '../data/csraApiTypes'
import csraTaskListController from './csraTaskListController'
import config from '../config'

const ASSESSMENT_ID = 'assessment-123'

const makeStageAnswers = (overrides: Partial<CsraAssessmentStageAnswers> = {}): CsraAssessmentStageAnswers => ({
  stage: 'PROVISIONAL',
  prisonId: 'MDI',
  offenceEvidence: [],
  riskTo: [],
  vulnerabilities: [],
  version: 1,
  ...overrides,
})

const makeAssessment = (overrides: Partial<CsraAssessment> = {}): CsraAssessment => ({
  assessmentId: ASSESSMENT_ID,
  prisonerNumber: 'A1234BC',
  status: 'IN_PROGRESS',
  startedBy: 'USER1',
  startedAt: '2026-09-07T10:00:00Z',
  stages: [makeStageAnswers({ pncChecked: true, seenByHealthcare: true })],
  ...overrides,
})

describe('csraTaskListController', () => {
  const csraService = {
    getCsraAssessment: jest.fn(),
  }

  const auditService = {
    logPageView: jest.fn().mockResolvedValue(null),
  }

  const warrantsService = {
    hasRecentWarrants: jest.fn().mockResolvedValue(false),
  }

  const controller = () => csraTaskListController({ auditService, csraService, warrantsService } as never)

  const request = () =>
    ({ id: 'request-id-123', params: { prisonerNumber: 'A1234BC', assessmentId: ASSESSMENT_ID } }) as any

  const response = () =>
    ({
      locals: {
        user: { username: 'user1' },
        prisoner: { prisonerNumber: 'A1234BC' },
      },
      render: jest.fn(),
    }) as any

  beforeEach(() => {
    jest.clearAllMocks()
    csraService.getCsraAssessment.mockResolvedValue(makeAssessment())
    warrantsService.hasRecentWarrants.mockResolvedValue(false)
    config.warrants.enabled = false
  })

  afterAll(() => {
    config.warrants.enabled = false
  })

  describe('the warrant evidence source', () => {
    it('does not look for warrants at all while the feature flag is off', async () => {
      const res = response()

      await controller()(request(), res, jest.fn())

      expect(warrantsService.hasRecentWarrants).not.toHaveBeenCalled()
      expect(res.render).toHaveBeenCalledWith('pages/csraTaskList', expect.objectContaining({ hasWarrants: false }))
    })

    it('offers the warrants link when the prisoner has recent warrants', async () => {
      config.warrants.enabled = true
      warrantsService.hasRecentWarrants.mockResolvedValue(true)
      const res = response()

      await controller()(request(), res, jest.fn())

      expect(res.render).toHaveBeenCalledWith(
        'pages/csraTaskList',
        expect.objectContaining({
          hasWarrants: true,
          warrantsUrl: `/prisoner/A1234BC/csra/${ASSESSMENT_ID}/warrants`,
        }),
      )
    })

    it('falls back to no warrants when the court API cannot be reached', async () => {
      config.warrants.enabled = true
      // hasRecentWarrants swallows its own failures; the task list must still render.
      warrantsService.hasRecentWarrants.mockResolvedValue(false)
      const res = response()

      await controller()(request(), res, jest.fn())

      expect(res.render).toHaveBeenCalledWith('pages/csraTaskList', expect.objectContaining({ hasWarrants: false }))
    })
  })

  it('renders the task list with a provisional rating link when the prerequisite sections are in progress', async () => {
    const assessmentAnswers = makeStageAnswers({ pncChecked: true, seenByHealthcare: true })
    csraService.getCsraAssessment.mockResolvedValue(
      makeAssessment({
        stages: [assessmentAnswers],
      }),
    )
    const res = response()

    await controller()(request(), res, jest.fn())

    expect(csraService.getCsraAssessment).toHaveBeenCalledWith('user1', 'A1234BC', ASSESSMENT_ID)
    expect(auditService.logPageView).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        who: 'user1',
        subjectId: ASSESSMENT_ID,
        subjectType: 'ASSESSMENT_ID',
        correlationId: 'request-id-123',
      }),
    )
    expect(res.render).toHaveBeenCalledWith(
      'pages/csraTaskList',
      expect.objectContaining({
        prisoner: { prisonerNumber: 'A1234BC' },
        assessment: expect.objectContaining({ assessmentId: ASSESSMENT_ID }),
        serviceUrls: expect.any(Object),
        taskLists: expect.arrayContaining([
          expect.objectContaining({ title: 'Operational assessment' }),
          expect.objectContaining({ title: 'Healthcare assessment' }),
          expect.objectContaining({ title: 'Rating' }),
        ]),
      }),
    )

    const renderLocals = res.render.mock.calls[0][1]
    expect(renderLocals.taskLists[2].sections[0]).toEqual(
      expect.objectContaining({
        title: 'Check answers and confirm rating',
        status: 'IN_PROGRESS',
        href: `/prisoner/A1234BC/csra/${ASSESSMENT_ID}/confirm-rating`,
      }),
    )
  })

  it('includes the provisional assessment task list when the assessment already has an interim result', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      makeAssessment({
        interimResult: 'HIGH_GENERAL',
      }),
    )
    const res = response()

    await controller()(request(), res, jest.fn())

    expect(auditService.logPageView).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        who: 'user1',
        subjectId: ASSESSMENT_ID,
        subjectType: 'ASSESSMENT_ID',
        correlationId: 'request-id-123',
      }),
    )
    expect(res.render).toHaveBeenCalledWith(
      'pages/csraTaskList',
      expect.objectContaining({
        taskLists: expect.arrayContaining([expect.objectContaining({ title: 'Provisional assessment' })]),
      }),
    )
  })

  it('rejects when the assessment is not found', async () => {
    csraService.getCsraAssessment.mockResolvedValue(null)

    await expect(controller()(request(), response(), jest.fn())).rejects.toMatchObject({ status: 404 })
  })
})

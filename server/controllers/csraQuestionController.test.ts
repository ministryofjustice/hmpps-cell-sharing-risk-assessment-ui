import { CsraAssessment, CsraAssessmentStageAnswers } from '../data/csraApiTypes'
import csraQuestionController from './csraQuestionController'

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
  stages: [makeStageAnswers()],
  ...overrides,
})

describe('csraQuestionController', () => {
  const csraService = {
    getCsraAssessment: jest.fn(),
    updateCsraAssessment: jest.fn(),
  }

  const auditService = {
    logPageView: jest.fn().mockResolvedValue(null),
  }

  const controller = () => csraQuestionController({ auditService, csraService } as never)

  const request = (method: 'GET' | 'POST' = 'GET', body: Record<string, unknown> = {}, stepId?: string) =>
    ({
      id: 'request-id-123',
      method,
      body,
      params: {
        prisonerNumber: 'A1234BC',
        assessmentId: ASSESSMENT_ID,
        sectionId: 'conversationAndVulnerability',
        ...(stepId ? { stepId } : {}),
      },
    }) as any

  const response = () =>
    ({
      locals: {
        user: { username: 'user1' },
        prisoner: { prisonerNumber: 'A1234BC' },
      },
      render: jest.fn(),
      redirect: jest.fn(),
    }) as any

  beforeEach(() => {
    jest.clearAllMocks()
    csraService.getCsraAssessment.mockResolvedValue(makeAssessment())
    csraService.updateCsraAssessment.mockResolvedValue(makeAssessment())
  })

  it('renders the first unanswered step for the section', async () => {
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
      'pages/csraQuestion',
      expect.objectContaining({
        title: 'Prisoner conversation and vulnerability',
        saveButtonText: 'Save and return',
        prisoner: { prisonerNumber: 'A1234BC' },
        backLink: `/prisoner/A1234BC/csra/${ASSESSMENT_ID}`,
        cancelLink: `/prisoner/A1234BC/csra/${ASSESSMENT_ID}`,
        values: {},
        currentStep: expect.objectContaining({
          questions: [expect.objectContaining({ id: 'officerSpokeToPrisoner' })],
        }),
      }),
    )
  })

  it('renders validation errors when the step is posted without an answer', async () => {
    const res = response()

    await controller()(request('POST'), res, jest.fn())

    expect(csraService.updateCsraAssessment).not.toHaveBeenCalled()
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
      'pages/csraQuestion',
      expect.objectContaining({
        backLink: `/prisoner/A1234BC/csra/${ASSESSMENT_ID}`,
        saveButtonText: 'Save and return',
        validationErrors: {
          officerSpokeToPrisoner: { text: 'TODO: select one' },
        },
      }),
    )
  })

  it.each(['GET', 'POST'] as const)('shows Save and return for a single-step section on %s', async method => {
    const req = request(method)
    req.params.sectionId = 'otherRisks'
    const res = response()

    await controller()(req, res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/csraQuestion',
      expect.objectContaining({ saveButtonText: 'Save and return' }),
    )
    expect(csraService.updateCsraAssessment).not.toHaveBeenCalled()
  })

  it.each([
    {
      description: 'a later step is available',
      stageAnswers: { officerSpokeToPrisoner: true },
      stepId: '0',
      saveButtonText: 'Save and continue',
    },
    {
      description: 'the current step is the last step',
      stageAnswers: { officerSpokeToPrisoner: true, likelyToHarmCellmate: false },
      stepId: '2',
      saveButtonText: 'Save and return',
    },
    {
      description: 'all later steps are skipped',
      stageAnswers: { officerSpokeToPrisoner: false },
      stepId: '0',
      saveButtonText: 'Save and return',
    },
  ])('chooses the button text when $description', async ({ stageAnswers, stepId, saveButtonText }) => {
    csraService.getCsraAssessment.mockResolvedValue(makeAssessment({ stages: [makeStageAnswers(stageAnswers)] }))
    const res = response()

    await controller()(request('GET', {}, stepId), res, jest.fn())

    expect(res.render).toHaveBeenCalledWith('pages/csraQuestion', expect.objectContaining({ saveButtonText }))
  })

  it('updates the assessment and redirects to the next step when the answer is valid', async () => {
    csraService.updateCsraAssessment.mockResolvedValue(
      makeAssessment({
        stages: [makeStageAnswers({ officerSpokeToPrisoner: true })],
      }),
    )
    const res = response()

    await controller()(request('POST', { officerSpokeToPrisoner: 'YES' }), res, jest.fn())

    expect(csraService.updateCsraAssessment).toHaveBeenCalledWith(
      'user1',
      'A1234BC',
      ASSESSMENT_ID,
      expect.objectContaining({
        officerSpokeToPrisoner: true,
        stage: 'PROVISIONAL',
        prisonId: 'MDI',
        version: 1,
      }),
    )
    expect(res.redirect).toHaveBeenCalledWith(
      `/prisoner/A1234BC/csra/${ASSESSMENT_ID}/section/conversationAndVulnerability/1`,
    )
  })

  it('throws when the section is unknown', async () => {
    const next = jest.fn()

    await expect(
      csraQuestionController({ auditService, csraService } as never)(
        {
          id: 'request-id-123',
          method: 'GET',
          body: {},
          params: {
            prisonerNumber: 'A1234BC',
            assessmentId: ASSESSMENT_ID,
            sectionId: 'unknown-section',
          },
        } as any,
        response(),
        next,
      ),
    ).rejects.toMatchObject({ status: 404 })
  })
})

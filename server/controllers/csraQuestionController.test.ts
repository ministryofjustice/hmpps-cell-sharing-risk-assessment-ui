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

  const request = (
    method: 'GET' | 'POST' = 'GET',
    body: Record<string, unknown> = {},
    stepId?: string,
    sectionId = 'conversationAndVulnerability',
  ) =>
    ({
      id: 'request-id-123',
      method,
      body,
      params: {
        prisonerNumber: 'A1234BC',
        assessmentId: ASSESSMENT_ID,
        sectionId,
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

  it('renders the first step for the section with a back link to the task list', async () => {
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
        prisoner: { prisonerNumber: 'A1234BC' },
        cancelLink: `/prisoner/A1234BC/csra/${ASSESSMENT_ID}`,
        backLink: `/prisoner/A1234BC/csra/${ASSESSMENT_ID}`,
        values: {},
        currentStep: expect.objectContaining({
          questions: [expect.objectContaining({ id: 'officerSpokeToPrisoner' })],
        }),
      }),
    )
  })

  it.each([
    { stepId: undefined, complete: false },
    { stepId: 'invalid', complete: false },
    { stepId: undefined, complete: true },
    { stepId: 'invalid', complete: true },
  ])(
    'starts at the first answered step for stepId $stepId when section complete is $complete',
    async ({ stepId, complete }) => {
      csraService.getCsraAssessment.mockResolvedValue(
        makeAssessment({
          stages: [
            makeStageAnswers({
              officerSpokeToPrisoner: true,
              ...(complete ? { likelyToHarmCellmate: false, significantlyVulnerable: false } : {}),
            }),
          ],
        }),
      )
      const res = response()

      await controller()(request('GET', {}, stepId), res, jest.fn())

      expect(res.render).toHaveBeenCalledWith(
        'pages/csraQuestion',
        expect.objectContaining({
          values: { officerSpokeToPrisoner: 'YES' },
          backLink: `/prisoner/A1234BC/csra/${ASSESSMENT_ID}`,
          currentStep: expect.objectContaining({
            questions: [expect.objectContaining({ id: 'officerSpokeToPrisoner' })],
          }),
        }),
      )
    },
  )

  it('links back to the last answered step when editing a later step', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      makeAssessment({
        stages: [makeStageAnswers({ officerSpokeToPrisoner: true, likelyToHarmCellmate: false })],
      }),
    )
    const res = response()

    await controller()(request('GET', {}, '2'), res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/csraQuestion',
      expect.objectContaining({
        backLink: `/prisoner/A1234BC/csra/${ASSESSMENT_ID}/section/conversationAndVulnerability/1`,
        currentStep: expect.objectContaining({
          questions: [expect.objectContaining({ id: 'significantlyVulnerable' })],
        }),
      }),
    )
  })

  it('does not allow an explicit step to skip an unanswered question', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      makeAssessment({ stages: [makeStageAnswers({ officerSpokeToPrisoner: true })] }),
    )
    const res = response()

    await controller()(request('GET', {}, '2'), res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/csraQuestion',
      expect.objectContaining({
        backLink: `/prisoner/A1234BC/csra/${ASSESSMENT_ID}/section/conversationAndVulnerability/0`,
        currentStep: expect.objectContaining({
          questions: [expect.objectContaining({ id: 'likelyToHarmCellmate' })],
        }),
      }),
    )
  })

  it('skips removed offence evidence steps when finding the back link', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      makeAssessment({
        stages: [
          makeStageAnswers({
            pncChecked: true,
            offenceMurderManslaughter: false,
            offenceAssistingSuicide: false,
            offenceEvidence: [
              { offence: 'MURDER_MANSLAUGHTER', sources: ['PNC'], details: 'Previously recorded evidence' },
            ],
          }),
        ],
      }),
    )
    const res = response()

    await controller()(request('GET', {}, '4', 'evidenceAndOffences'), res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/csraQuestion',
      expect.objectContaining({
        backLink: `/prisoner/A1234BC/csra/${ASSESSMENT_ID}/section/evidenceAndOffences/1`,
        currentStep: expect.objectContaining({
          questions: [expect.objectContaining({ id: 'offenceSexualAssault' })],
        }),
      }),
    )
  })

  it('keeps the back link when a later step has validation errors', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      makeAssessment({ stages: [makeStageAnswers({ officerSpokeToPrisoner: true })] }),
    )
    const res = response()

    await controller()(request('POST', {}, '1'), res, jest.fn())

    expect(csraService.updateCsraAssessment).not.toHaveBeenCalled()
    expect(res.render).toHaveBeenCalledWith(
      'pages/csraQuestion',
      expect.objectContaining({
        backLink: `/prisoner/A1234BC/csra/${ASSESSMENT_ID}/section/conversationAndVulnerability/0`,
        validationErrors: { likelyToHarmCellmate: { text: 'TODO: select one' } },
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
        validationErrors: {
          officerSpokeToPrisoner: { text: 'TODO: select one' },
        },
      }),
    )
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

  it('skips conditional offence evidence steps after saving negative offence answers', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      makeAssessment({ stages: [makeStageAnswers({ pncChecked: true })] }),
    )
    csraService.updateCsraAssessment.mockResolvedValue(
      makeAssessment({
        stages: [
          makeStageAnswers({ pncChecked: true, offenceMurderManslaughter: false, offenceAssistingSuicide: false }),
        ],
      }),
    )
    const res = response()

    await controller()(
      request('POST', { offenceMurderManslaughter: 'NO', offenceAssistingSuicide: 'NO' }, '1', 'evidenceAndOffences'),
      res,
      jest.fn(),
    )

    expect(csraService.updateCsraAssessment).toHaveBeenCalledWith(
      'user1',
      'A1234BC',
      ASSESSMENT_ID,
      expect.objectContaining({ offenceMurderManslaughter: false, offenceAssistingSuicide: false }),
    )
    expect(res.redirect).toHaveBeenCalledWith(`/prisoner/A1234BC/csra/${ASSESSMENT_ID}/section/evidenceAndOffences/4`)
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

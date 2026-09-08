import { CsraAssessment, CsraAssessmentStageAnswers } from '../data/csraApiTypes'
import flowConfig from '../lib/transactionFlow/config'
import csraConfirmRatingController from './csraConfirmRatingController'

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

describe('csraConfirmRatingController', () => {
  const csraService = {
    getCsraAssessment: jest.fn(),
    submitProvisionalRating: jest.fn(),
  }

  const controller = () => csraConfirmRatingController({ auditService: {} as never, csraService } as never)

  const request = (method: 'GET' | 'POST' = 'GET') =>
    ({
      id: 'request-id-123',
      method,
      params: { prisonerNumber: 'A1234BC', assessmentId: ASSESSMENT_ID },
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
    csraService.submitProvisionalRating.mockResolvedValue(undefined)
  })

  it('renders the confirmation page with the current answers', async () => {
    const stageAnswers = makeStageAnswers({ pncChecked: true, seenByHealthcare: true })
    csraService.getCsraAssessment.mockResolvedValue(
      makeAssessment({
        stages: [stageAnswers],
      }),
    )
    const res = response()

    await controller()(request(), res, jest.fn())

    expect(csraService.getCsraAssessment).toHaveBeenCalledWith('user1', 'A1234BC', ASSESSMENT_ID)
    expect(res.render).toHaveBeenCalledWith(
      'pages/csraConfirmRating',
      expect.objectContaining({
        prisoner: { prisonerNumber: 'A1234BC' },
        assessment: expect.objectContaining({ assessmentId: ASSESSMENT_ID }),
        assessmentAnswers: stageAnswers,
        flowConfig,
      }),
    )
  })

  it('submits the provisional rating and redirects back to the prisoner page', async () => {
    const stageAnswers = makeStageAnswers({ pncChecked: true, seenByHealthcare: true })
    csraService.getCsraAssessment.mockResolvedValue(
      makeAssessment({
        stages: [stageAnswers],
      }),
    )
    const res = response()

    await controller()(request('POST'), res, jest.fn())

    expect(csraService.submitProvisionalRating).toHaveBeenCalledWith(
      'user1',
      'A1234BC',
      ASSESSMENT_ID,
      expect.objectContaining({
        rating: 'HIGH_GENERAL',
        assessmentComment: 'WIP generated comment',
        stage: 'PROVISIONAL',
        prisonId: 'MDI',
        pncChecked: true,
        seenByHealthcare: true,
      }),
    )
    expect(res.redirect).toHaveBeenCalledWith('/prisoner/A1234BC')
  })

  it('rejects when the assessment is not found', async () => {
    csraService.getCsraAssessment.mockResolvedValue(null)

    await expect(controller()(request(), response(), jest.fn())).rejects.toMatchObject({ status: 404 })
  })
})

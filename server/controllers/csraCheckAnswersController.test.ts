import { CsraAssessment, CsraAssessmentStageAnswers, CsraOffenceEvidence, OffenceType } from '../data/csraApiTypes'
import flowConfig from '../lib/transactionFlow/config'
import csraCheckAnswersController from './csraCheckAnswersController'

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

const answeredOffences: Partial<CsraAssessmentStageAnswers> = {
  pncChecked: true,
  offenceMurderManslaughter: false,
  offenceAssistingSuicide: false,
  offenceSexualAssault: false,
  offenceRepeatedViolence: false,
  offencePrejudiceMotivated: false,
  offenceArson: false,
  offenceKidnapHostage: false,
}

const makeAssessment = (overrides: Partial<CsraAssessment> = {}): CsraAssessment => ({
  assessmentId: ASSESSMENT_ID,
  prisonerNumber: 'A1234BC',
  status: 'IN_PROGRESS',
  startedBy: 'USER1',
  startedAt: '2026-09-07T10:00:00Z',
  stages: [
    makeStageAnswers({
      ...answeredOffences,
      dpsChecked: true,
      perChecked: true,
      warrantChecked: true,
      seenByHealthcare: true,
      healthcareIncreasedRisk: false,
      officerSpokeToPrisoner: true,
      likelyToHarmCellmate: false,
      significantlyVulnerable: false,
      causeForConcernSharing: false,
      otherHighRiskIndicators: false,
    }),
  ],
  ...overrides,
})

describe('csraCheckAnswersController', () => {
  const csraService = {
    getCsraAssessment: jest.fn(),
  }

  const auditService = {
    logPageView: jest.fn().mockResolvedValue(null),
  }

  const controller = () => csraCheckAnswersController({ auditService, csraService } as never)

  const request = () =>
    ({
      id: 'request-id-123',
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
  })

  it('renders the check answers page for a complete assessment', async () => {
    const assessmentAnswers = makeAssessment().stages[0]
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
      'pages/csraCheckAnswers',
      expect.objectContaining({
        prisoner: { prisonerNumber: 'A1234BC' },
        assessment: expect.objectContaining({ assessmentId: ASSESSMENT_ID }),
        assessmentAnswers,
        submitType: 'FINAL',
        remainingTasks: [],
        backLink: `/prisoner/A1234BC/csra/${ASSESSMENT_ID}`,
        cancelLink: `/prisoner/A1234BC/csra/${ASSESSMENT_ID}`,
        flowConfig,
      }),
    )
  })

  it('renders the provisional check answers page with remaining tasks', async () => {
    const assessmentAnswers = makeStageAnswers({
      ...answeredOffences,
      dpsChecked: true,
      perChecked: true,
      warrantChecked: true,
      officerSpokeToPrisoner: true,
      likelyToHarmCellmate: false,
      significantlyVulnerable: false,
      causeForConcernSharing: false,
      otherHighRiskIndicators: false,
      seenByHealthcare: false,
    })
    csraService.getCsraAssessment.mockResolvedValue(
      makeAssessment({
        stages: [assessmentAnswers],
      }),
    )
    const res = response()

    await controller()(request(), res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/csraCheckAnswers',
      expect.objectContaining({
        assessmentAnswers,
        submitType: 'PROVISIONAL',
        remainingTasks: ['ensure the prisoner has been seen by healthcare'],
      }),
    )
  })

  it('redirects to the assessment when submitType is NONE', async () => {
    csraService.getCsraAssessment.mockResolvedValue(makeAssessment({ stages: [makeStageAnswers()] }))
    const res = response()

    await controller()(request(), res, jest.fn())

    expect(res.redirect).toHaveBeenCalledWith(`/prisoner/A1234BC/csra/${ASSESSMENT_ID}`)
    expect(res.render).not.toHaveBeenCalled()
    expect(auditService.logPageView).not.toHaveBeenCalled()
  })

  it('renders a final-rating check page with no remaining tasks when all sections are complete', async () => {
    const res = response()

    await controller()(request(), res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/csraCheckAnswers',
      expect.objectContaining({
        submitType: 'FINAL',
        remainingTasks: [],
      }),
    )
  })

  it('maps offence evidence to the corresponding assessment answer keys', async () => {
    const offences: OffenceType[] = [
      'MURDER_MANSLAUGHTER',
      'ASSISTING_SUICIDE',
      'SEXUAL_ASSAULT',
      'REPEATED_VIOLENCE',
      'PREJUDICE_MOTIVATED',
      'ARSON',
      'KIDNAP_HOSTAGE',
    ]
    const offenceEvidence: CsraOffenceEvidence[] = offences.map(offence => ({
      offence,
      sources: ['PNC'],
      details: `${offence} details`,
    }))
    csraService.getCsraAssessment.mockResolvedValue(
      makeAssessment({
        stages: [makeStageAnswers({ ...answeredOffences, seenByHealthcare: false, offenceEvidence })],
      }),
    )
    const res = response()

    await controller()(request(), res, jest.fn())

    expect(res.render.mock.calls[0][1].offenceEvidenceMap).toEqual({
      offenceMurderManslaughter: offenceEvidence[0],
      offenceAssistingSuicide: offenceEvidence[1],
      offenceSexualAssault: offenceEvidence[2],
      offenceRepeatedViolence: offenceEvidence[3],
      offencePrejudiceMotivated: offenceEvidence[4],
      offenceArson: offenceEvidence[5],
      offenceKidnapHostage: offenceEvidence[6],
    })
  })

  it('rejects when the assessment is not found', async () => {
    csraService.getCsraAssessment.mockResolvedValue(null)

    await expect(controller()(request(), response(), jest.fn())).rejects.toMatchObject({ status: 404 })
  })
})

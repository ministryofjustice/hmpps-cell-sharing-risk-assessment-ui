import { CsraAssessment, CsraAssessmentStageAnswers } from '../data/csraApiTypes'
import csraQuestionController from './csraQuestionController'
import getAnswersFromAssessment from './getAnswersFromAssessment'
import flowConfig from '../lib/transactionFlow/config'
import InformationStep from '../lib/transactionFlow/informationStep'
import getTaskListSections from '../utils/getTaskListSections'
import Step from '../lib/transactionFlow/step'
import YesNoQuestion from '../lib/transactionFlow/questionTypes/yesNo'

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
      query: {},
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
      status: jest.fn().mockReturnThis(),
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
        saveButtonText: 'Save and continue',
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

  it('keeps the referrers on the back and cancel links, and on the redirect to the next step', async () => {
    const res = response()

    await controller()({ ...request(), query: { referrer: ['due-for-review'] } }, res, jest.fn())
    expect(res.render).toHaveBeenCalledWith(
      'pages/csraQuestion',
      expect.objectContaining({
        backLink: `/prisoner/A1234BC/csra/${ASSESSMENT_ID}?referrer=due-for-review`,
        cancelLink: `/prisoner/A1234BC/csra/${ASSESSMENT_ID}?referrer=due-for-review`,
      }),
    )

    const postRes = response()
    await controller()(
      { ...request('POST', { officerSpokeToPrisoner: 'YES' }), query: { referrer: ['due-for-review'] } },
      postRes,
      jest.fn(),
    )
    expect(postRes.redirect).toHaveBeenCalledWith(`/prisoner/A1234BC/csra/${ASSESSMENT_ID}?referrer=due-for-review`)
  })

  it('passes provisional-rating state to the evidence sources question', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      makeAssessment({
        interimResult: 'HIGH_GENERAL',
        stages: [makeStageAnswers({ pncChecked: true })],
      }),
    )
    const res = response()

    await controller()(request('GET', {}, '0', 'evidenceAndOffences'), res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/csraQuestion',
      expect.objectContaining({
        provisionalRatingEntered: true,
        questionContext: expect.objectContaining({ provisionalRatingEntered: true }),
        currentStep: expect.objectContaining({
          questions: [expect.objectContaining({ id: 'evidenceSources' })],
        }),
      }),
    )
  })

  it.each(['GET', 'POST'] as const)('blocks a submitted assessment question on %s', async method => {
    csraService.getCsraAssessment.mockResolvedValue(makeAssessment({ finalResult: 'STANDARD' }))
    const res = response()

    await controller()(request(method, { officerSpokeToPrisoner: 'true' }), res, jest.fn())

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.render).toHaveBeenCalledWith('pages/csraAssessmentSubmitted', {
      returnLink: '/prisoner/A1234BC',
    })
    expect(csraService.updateCsraAssessment).not.toHaveBeenCalled()
    expect(auditService.logPageView).not.toHaveBeenCalled()
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

    await controller()(request('GET', {}, '5', 'evidenceAndOffences'), res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/csraQuestion',
      expect.objectContaining({
        backLink: `/prisoner/A1234BC/csra/${ASSESSMENT_ID}/section/evidenceAndOffences/2`,
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
        validationErrors: {
          likelyToHarmCellmate: {
            text: 'Select yes if there is reason to believe the prisoner is likely to cause harm to someone they share a cell with',
          },
        },
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
        saveButtonText: 'Save and continue',
        validationErrors: {
          officerSpokeToPrisoner: {
            text: 'Select yes if an officer has spoken with the prisoner about sharing a cell',
          },
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
      saveButtonText: 'Save and continue',
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
      'PROVISIONAL',
    )
    expect(res.redirect).toHaveBeenCalledWith(
      `/prisoner/A1234BC/csra/${ASSESSMENT_ID}/section/conversationAndVulnerability/1`,
    )
  })

  it('updates the final stage after a provisional rating has been submitted', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      makeAssessment({
        interimResult: 'HIGH_GENERAL',
        stages: [makeStageAnswers(), makeStageAnswers({ stage: 'FINAL' })],
      }),
    )
    const res = response()

    await controller()(request('POST', { officerSpokeToPrisoner: 'YES' }), res, jest.fn())

    expect(csraService.updateCsraAssessment).toHaveBeenCalledWith(
      'user1',
      'A1234BC',
      ASSESSMENT_ID,
      expect.objectContaining({ stage: 'FINAL', officerSpokeToPrisoner: true }),
      'FINAL',
    )
  })

  it('routes to the configured review step after saving new evidence sources in a final assessment', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      makeAssessment({
        interimResult: 'HIGH_GENERAL',
        stages: [makeStageAnswers({ stage: 'PROVISIONAL', pncChecked: true })],
      }),
    )
    csraService.updateCsraAssessment.mockResolvedValue(
      makeAssessment({
        interimResult: 'HIGH_GENERAL',
        stages: [makeStageAnswers({ stage: 'FINAL', pncChecked: true, warrantChecked: true })],
      }),
    )
    const res = response()

    await controller()(
      request('POST', { evidenceSources: ['warrantChecked'] }, '0', 'evidenceAndOffences'),
      res,
      jest.fn(),
    )

    expect(csraService.updateCsraAssessment).toHaveBeenCalledWith(
      'user1',
      'A1234BC',
      ASSESSMENT_ID,
      expect.objectContaining({ stage: 'FINAL', pncChecked: true, warrantChecked: true }),
      'FINAL',
    )
    expect(res.redirect).toHaveBeenCalledWith(`/prisoner/A1234BC/csra/${ASSESSMENT_ID}/section/evidenceAndOffences/1`)
  })

  it.each([
    ['', []],
    ['?referrer=due-for-review&referrer=history', ['due-for-review', 'history']],
  ])('renders the information step preserving referrers %s without saving', async (query, referrers) => {
    csraService.getCsraAssessment.mockResolvedValue(
      makeAssessment({
        interimResult: 'HIGH_GENERAL',
        stages: [makeStageAnswers({ stage: 'FINAL', pncChecked: true })],
      }),
    )
    const res = response()

    await controller()(
      { ...request('GET', {}, '1', 'evidenceAndOffences'), query: { referrer: referrers } },
      res,
      jest.fn(),
    )

    expect(csraService.updateCsraAssessment).not.toHaveBeenCalled()
    expect(res.render).toHaveBeenCalledWith(
      'pages/csraInformationStep',
      expect.objectContaining({
        title: 'Review offences after checking new evidence source',
        backLink: `/prisoner/A1234BC/csra/${ASSESSMENT_ID}/section/evidenceAndOffences/0${query}`,
        continueLink: `/prisoner/A1234BC/csra/${ASSESSMENT_ID}/section/evidenceAndOffences/2${query}`,
        cancelLink: `/prisoner/A1234BC/csra/${ASSESSMENT_ID}${query}`,
      }),
    )
  })

  it('saves the configured information step when it is submitted and continues to the next step', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      makeAssessment({
        interimResult: 'HIGH_GENERAL',
        stages: [makeStageAnswers({ stage: 'FINAL', pncChecked: true })],
      }),
    )
    const res = response()

    await controller()(request('POST', {}, '1', 'evidenceAndOffences'), res, jest.fn())

    expect(csraService.updateCsraAssessment).toHaveBeenCalled()
    expect(res.redirect).toHaveBeenCalledWith(`/prisoner/A1234BC/csra/${ASSESSMENT_ID}/section/evidenceAndOffences/2`)
  })

  it('creates the final stage at version 1 from the provisional answers when no final stage exists yet', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      makeAssessment({
        interimResult: 'HIGH_GENERAL',
        stages: [
          makeStageAnswers({
            seenByHealthcare: true,
            version: 3,
            pncChecked: true,
            offenceMurderManslaughter: true,
            offenceEvidence: [{ offence: 'MURDER_MANSLAUGHTER', sources: ['PNC'], details: 'Original evidence' }],
          }),
        ],
      }),
    )
    const res = response()

    await controller()(request('POST', { officerSpokeToPrisoner: 'YES' }), res, jest.fn())

    expect(csraService.updateCsraAssessment).toHaveBeenCalledWith(
      'user1',
      'A1234BC',
      ASSESSMENT_ID,
      expect.objectContaining({
        stage: 'FINAL',
        version: 1,
        seenByHealthcare: true,
        officerSpokeToPrisoner: true,
        pncChecked: null,
        offenceMurderManslaughter: null,
        offenceEvidence: [],
      }),
      'FINAL',
    )
  })

  it.each([false, true])('requires every applicable evidence page to be saved when an offence is %s', async offence => {
    const provisional = makeStageAnswers({
      pncChecked: true,
      warrantChecked: true,
      dpsChecked: true,
      perChecked: true,
      offenceMurderManslaughter: offence,
      offenceAssistingSuicide: false,
      offenceSexualAssault: false,
      offenceRepeatedViolence: false,
      offencePrejudiceMotivated: false,
      offenceArson: false,
      offenceKidnapHostage: false,
      offenceEvidence: [
        {
          offence: 'MURDER_MANSLAUGHTER',
          sources: ['PNC', 'OTHER'],
          otherSourceDetail: 'Local records',
          details: 'Provisional evidence',
        },
      ],
    })
    const original = structuredClone(provisional)
    let assessment = makeAssessment({ interimResult: 'HIGH_GENERAL', stages: [provisional] })
    const { prisoner } = response().locals
    const status = () =>
      getTaskListSections(assessment, getAnswersFromAssessment(assessment), prisoner, []).evidenceAndOffences.status
    expect(status()).toBe('IN_PROGRESS')

    csraService.getCsraAssessment.mockImplementation(async () => assessment)
    csraService.updateCsraAssessment.mockImplementation(
      async (_username, _prisonerNumber, _assessmentId, answers: CsraAssessmentStageAnswers) => {
        assessment = { ...assessment, stages: [provisional, { ...answers, version: answers.version + 1 }] }
        return assessment
      },
    )

    const { steps } = flowConfig.evidenceAndOffences
    let savedPages = 0
    /* eslint-disable no-await-in-loop -- Each page must read the answers persisted by the previous submission. */
    for (const [stepId, step] of steps.entries()) {
      if (!step.removeIf(getAnswersFromAssessment(assessment))) {
        expect(status()).not.toBe('COMPLETE')
        const res = response()
        await controller()(request('GET', {}, String(stepId), 'evidenceAndOffences'), res, jest.fn())
        expect(csraService.updateCsraAssessment).toHaveBeenCalledTimes(savedPages)

        if (!(step instanceof InformationStep)) {
          const formValues = step.getFormValues(provisional)
          expect(res.render).toHaveBeenCalledWith('pages/csraQuestion', expect.objectContaining({ values: formValues }))
          await controller()(request('POST', formValues, String(stepId), 'evidenceAndOffences'), response(), jest.fn())
          savedPages += 1
          expect(csraService.updateCsraAssessment).toHaveBeenCalledTimes(savedPages)
        } else {
          await controller()(request('POST', {}, String(stepId), 'evidenceAndOffences'), response(), jest.fn())
          savedPages += 1
          expect(csraService.updateCsraAssessment).toHaveBeenCalledTimes(savedPages)
        }
      }
    }
    /* eslint-enable no-await-in-loop */

    expect(savedPages).toBe(offence ? 9 : 8)
    expect(status()).toBe('COMPLETE')
    expect(getAnswersFromAssessment(assessment).offenceEvidence).toEqual(offence ? provisional.offenceEvidence : [])
    expect(provisional).toEqual(original)
  })

  it.each([false, true])(
    'uses the configured next step to mark evidence reviewed (new step applicable: %s)',
    async applicable => {
      const section = flowConfig.evidenceAndOffences
      const finalQuestionId = section.steps.findIndex(step =>
        step.questions.some(question => question.id === 'offenceKidnapHostage'),
      )
      const newStep = new Step({
        questions: [new YesNoQuestion('New evidence question', 'seenByHealthcare')],
      }).onlyWhen(() => applicable)
      const replacement = jest.replaceProperty(flowConfig, 'evidenceAndOffences', {
        ...section,
        steps: [...section.steps, newStep],
      })
      let assessment = makeAssessment({
        interimResult: 'HIGH_GENERAL',
        stages: [
          makeStageAnswers({
            stage: 'FINAL',
            pncChecked: true,
            offenceMurderManslaughter: false,
            offenceAssistingSuicide: false,
            offenceSexualAssault: false,
            offenceRepeatedViolence: false,
            offencePrejudiceMotivated: false,
            offenceArson: false,
            offenceKidnapHostage: false,
            offenceEvidenceReviewed: false,
          }),
        ],
      })
      csraService.getCsraAssessment.mockImplementation(async () => assessment)
      csraService.updateCsraAssessment.mockImplementation(
        async (_username, _prisonerNumber, _assessmentId, answers: CsraAssessmentStageAnswers) => {
          assessment = { ...assessment, stages: [answers] }
          return assessment
        },
      )
      try {
        const res = response()
        await controller()(
          request('POST', { offenceKidnapHostage: 'NO' }, String(finalQuestionId), 'evidenceAndOffences'),
          res,
          jest.fn(),
        )
        expect(getAnswersFromAssessment(assessment).offenceEvidenceReviewed).toBe(!applicable)
        const assessmentUrl = `/prisoner/A1234BC/csra/${ASSESSMENT_ID}`
        expect(res.redirect).toHaveBeenCalledWith(
          applicable ? `${assessmentUrl}/section/evidenceAndOffences/${section.steps.length}` : assessmentUrl,
        )
        if (applicable) {
          await controller()(
            request('POST', { seenByHealthcare: 'NO' }, String(section.steps.length), 'evidenceAndOffences'),
            response(),
            jest.fn(),
          )
          expect(getAnswersFromAssessment(assessment).offenceEvidenceReviewed).toBe(true)
        }
      } finally {
        replacement.restore()
      }
    },
  )

  it('uses saved final offence answers, including false, ahead of provisional answers', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      makeAssessment({
        interimResult: 'HIGH_GENERAL',
        stages: [
          makeStageAnswers({ offenceMurderManslaughter: true, offenceAssistingSuicide: false }),
          makeStageAnswers({
            stage: 'FINAL',
            pncChecked: true,
            offenceMurderManslaughter: false,
            offenceAssistingSuicide: null,
          }),
        ],
      }),
    )
    const res = response()

    await controller()(request('GET', {}, '2', 'evidenceAndOffences'), res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/csraQuestion',
      expect.objectContaining({
        values: { offenceMurderManslaughter: 'NO', offenceAssistingSuicide: 'NO' },
      }),
    )
  })

  it('uses saved final offence evidence sources and details ahead of provisional evidence', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      makeAssessment({
        interimResult: 'HIGH_GENERAL',
        stages: [
          makeStageAnswers({
            offenceEvidence: [{ offence: 'MURDER_MANSLAUGHTER', sources: ['PNC'], details: 'Old evidence' }],
          }),
          makeStageAnswers({
            stage: 'FINAL',
            dpsChecked: true,
            offenceMurderManslaughter: true,
            offenceAssistingSuicide: false,
            offenceEvidence: [{ offence: 'MURDER_MANSLAUGHTER', sources: ['DPS'], details: 'Updated evidence' }],
          }),
        ],
      }),
    )
    const res = response()

    await controller()(request('GET', {}, '3', 'evidenceAndOffences'), res, jest.fn())

    expect(res.render).toHaveBeenCalledWith(
      'pages/csraQuestion',
      expect.objectContaining({
        values: { evidenceSources: ['DPS'], otherSource: '', likelyToHarmCellmateDetail: 'Updated evidence' },
      }),
    )
  })

  it('keeps submitted evidence values on validation errors instead of restoring provisional values', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      makeAssessment({
        interimResult: 'HIGH_GENERAL',
        stages: [
          makeStageAnswers({
            offenceEvidence: [{ offence: 'MURDER_MANSLAUGHTER', sources: ['PNC'], details: 'Old evidence' }],
          }),
          makeStageAnswers({
            stage: 'FINAL',
            pncChecked: true,
            offenceMurderManslaughter: true,
            offenceAssistingSuicide: false,
          }),
        ],
      }),
    )
    const res = response()

    await controller()(
      request('POST', { evidenceSources: ['PNC'], likelyToHarmCellmateDetail: '' }, '3', 'evidenceAndOffences'),
      res,
      jest.fn(),
    )

    expect(csraService.updateCsraAssessment).not.toHaveBeenCalled()
    expect(res.render).toHaveBeenCalledWith(
      'pages/csraQuestion',
      expect.objectContaining({
        values: expect.objectContaining({ evidenceSources: ['PNC'], likelyToHarmCellmateDetail: '' }),
        validationErrors: { likelyToHarmCellmateDetail: { text: 'Enter details of the evidence' } },
      }),
    )
  })

  it.each([
    {
      sectionId: 'conversationAndVulnerability',
      prerequisite: 'officerSpokeToPrisoner',
      dependentAnswers: {
        likelyToHarmCellmate: true,
        likelyToHarmCellmateDetail: 'Risk detail',
        significantlyVulnerable: true,
        significantlyVulnerableDetail: 'Vulnerability detail',
      },
    },
    {
      sectionId: 'healthcare',
      prerequisite: 'seenByHealthcare',
      dependentAnswers: {
        healthcareIncreasedRisk: true,
        healthcareIncreasedRiskDetail: 'Healthcare detail',
      },
    },
  ])(
    'updates dependent answers in $sectionId when the prerequisite changes',
    async ({ sectionId, prerequisite, dependentAnswers }) => {
      const assessment = makeStageAnswers({
        ...dependentAnswers,
        [prerequisite]: true,
        causeForConcernSharing: true,
        causeForConcernSharingDetail: 'Unrelated observation',
      })
      const original = structuredClone(assessment)
      csraService.getCsraAssessment.mockResolvedValue(makeAssessment({ stages: [assessment] }))
      const clearedAnswers = Object.fromEntries(Object.keys(dependentAnswers).map((key): [string, null] => [key, null]))
      const savedAnswers = makeStageAnswers({
        ...assessment,
        [prerequisite]: false,
        ...clearedAnswers,
      })
      csraService.updateCsraAssessment.mockResolvedValue(makeAssessment({ stages: [savedAnswers] }))
      const res = response()

      await controller()(request('POST', { [prerequisite]: 'NO' }, '0', sectionId), res, jest.fn())

      expect(csraService.updateCsraAssessment).toHaveBeenCalledWith(
        'user1',
        'A1234BC',
        ASSESSMENT_ID,
        savedAnswers,
        'PROVISIONAL',
      )
      expect(assessment).toEqual(original)
      expect(res.redirect).toHaveBeenCalledWith(`/prisoner/A1234BC/csra/${ASSESSMENT_ID}`)
    },
  )

  it('retains dependent answers when the prerequisite remains fulfilled', async () => {
    const assessment = makeStageAnswers({
      officerSpokeToPrisoner: true,
      likelyToHarmCellmate: true,
      likelyToHarmCellmateDetail: 'Risk detail',
      significantlyVulnerable: false,
      seenByHealthcare: true,
    })
    const original = structuredClone(assessment)
    csraService.getCsraAssessment.mockResolvedValue(makeAssessment({ stages: [assessment] }))
    csraService.updateCsraAssessment.mockResolvedValue(makeAssessment({ stages: [assessment] }))
    const res = response()

    await controller()(request('POST', { officerSpokeToPrisoner: 'YES' }, '0'), res, jest.fn())

    expect(csraService.updateCsraAssessment).toHaveBeenCalledWith(
      'user1',
      'A1234BC',
      ASSESSMENT_ID,
      original,
      'PROVISIONAL',
    )
    expect(assessment).toEqual(original)
  })

  it.each([{ offenceEvidence: null }, { offenceEvidence: [] }])(
    'skips conditional offence evidence steps with empty evidence $offenceEvidence',
    async ({ offenceEvidence }) => {
      csraService.getCsraAssessment.mockResolvedValue(
        makeAssessment({ stages: [makeStageAnswers({ pncChecked: true, offenceEvidence })] }),
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
        request('POST', { offenceMurderManslaughter: 'NO', offenceAssistingSuicide: 'NO' }, '2', 'evidenceAndOffences'),
        res,
        jest.fn(),
      )

      expect(csraService.updateCsraAssessment).toHaveBeenCalledWith(
        'user1',
        'A1234BC',
        ASSESSMENT_ID,
        expect.objectContaining({ offenceMurderManslaughter: false, offenceAssistingSuicide: false, offenceEvidence }),
        'PROVISIONAL',
      )
      expect(res.redirect).toHaveBeenCalledWith(`/prisoner/A1234BC/csra/${ASSESSMENT_ID}/section/evidenceAndOffences/5`)
    },
  )

  it('clears evidence for a removed offence step while preserving evidence for an available step', async () => {
    const assessment = makeStageAnswers({
      pncChecked: true,
      offenceMurderManslaughter: true,
      offenceAssistingSuicide: true,
      offenceEvidence: [
        { offence: 'MURDER_MANSLAUGHTER', sources: ['PNC'], details: 'Evidence to clear' },
        {
          offence: 'ASSISTING_SUICIDE',
          sources: ['OTHER'],
          otherSourceDetail: 'Other source',
          details: 'Evidence to retain',
        },
      ],
      likelyToHarmCellmateDetail: 'Unrelated detail',
    })
    const original = structuredClone(assessment)
    const savedAnswers = makeStageAnswers({
      ...assessment,
      offenceMurderManslaughter: false,
      offenceEvidence: [assessment.offenceEvidence[1]],
    })
    csraService.getCsraAssessment.mockResolvedValue(makeAssessment({ stages: [assessment] }))
    csraService.updateCsraAssessment.mockResolvedValue(makeAssessment({ stages: [savedAnswers] }))
    const res = response()

    await controller()(
      request('POST', { offenceMurderManslaughter: 'NO', offenceAssistingSuicide: 'YES' }, '2', 'evidenceAndOffences'),
      res,
      jest.fn(),
    )

    expect(csraService.updateCsraAssessment).toHaveBeenCalledWith(
      'user1',
      'A1234BC',
      ASSESSMENT_ID,
      savedAnswers,
      'PROVISIONAL',
    )
    expect(assessment).toEqual(original)
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

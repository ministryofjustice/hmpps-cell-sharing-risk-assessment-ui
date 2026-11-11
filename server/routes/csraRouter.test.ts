import request from 'supertest'

import { appWithAllRoutes, flashProvider, user } from './testutils/appSetup'
import type { Prisoner } from '../data/prisonerSearchApiTypes'
import type { CsraAssessment, CsraAssessmentStageAnswers } from '../data/csraApiTypes'
import { Role } from '../utils/roles'
import flowConfig from '../lib/transactionFlow/config'
import config from '../config'
import getAnswersFromAssessment from '../controllers/getAnswersFromAssessment'
import { Page } from '../services/auditService'
import InformationStep from '../lib/transactionFlow/informationStep'

const prisoner: Prisoner = {
  prisonerNumber: 'A1234BC',
  firstName: 'JOHN',
  lastName: 'SMITH',
  prisonId: 'LEI',
  prisonName: 'Leeds (HMP)',
  dateOfBirth: '1972-02-03',
}

const assessmentUrl = '/prisoner/A1234BC/csra/assessment-123'

const stageAnswers = (overrides: Partial<CsraAssessmentStageAnswers> = {}): CsraAssessmentStageAnswers => ({
  stage: 'PROVISIONAL',
  prisonId: 'LEI',
  offenceEvidence: [],
  riskTo: [],
  vulnerabilities: [],
  version: 1,
  offenceEvidenceReviewed: null,
  ...overrides,
})

const completeStageAnswers = (overrides: Partial<CsraAssessmentStageAnswers> = {}): CsraAssessmentStageAnswers =>
  stageAnswers({
    dpsChecked: true,
    perChecked: true,
    warrantChecked: true,
    pncChecked: true,
    offenceMurderManslaughter: false,
    offenceAssistingSuicide: false,
    offenceSexualAssault: false,
    offenceRepeatedViolence: false,
    offencePrejudiceMotivated: false,
    offenceArson: false,
    offenceKidnapHostage: false,
    offenceEvidenceReviewed: true,
    officerSpokeToPrisoner: true,
    likelyToHarmCellmate: false,
    significantlyVulnerable: false,
    causeForConcernSharing: false,
    otherHighRiskIndicators: false,
    seenByHealthcare: true,
    healthcareIncreasedRisk: false,
    ...overrides,
  })

const assessment = (overrides: Partial<CsraAssessment> = {}): CsraAssessment => ({
  assessmentId: 'assessment-123',
  prisonerNumber: prisoner.prisonerNumber,
  status: 'IN_PROGRESS',
  startedBy: 'USER1',
  startedAt: '2026-09-07T10:00:00Z',
  stages: [stageAnswers()],
  ...overrides,
})

describe('csraRouter', () => {
  const auditService = { logPageView: jest.fn().mockResolvedValue(null) }
  const csraService = {
    getCsraAssessment: jest.fn(),
    getCurrentRating: jest.fn(),
    getDetailedRating: jest.fn(),
    startCsraAssessment: jest.fn(),
    cancelCsraAssessment: jest.fn(),
    submitProvisionalRating: jest.fn().mockResolvedValue({}),
    submitFinalRating: jest.fn().mockResolvedValue({}),
    updateCsraAssessment: jest.fn(),
  }
  const prisonerSearchService = {
    getPrisoner: jest.fn(),
  }
  const manageUsersService = {
    getUserCaseloads: jest.fn(),
    getUserDetails: jest.fn(),
  }
  const prisonApiService = {} as never
  const activeAgenciesService = {
    getActiveAgencyIds: jest.fn(),
    isPrisonActive: jest.fn(),
    invalidate: jest.fn(),
  }

  const buildApp = (roles: string[]) =>
    appWithAllRoutes({
      services: {
        auditService,
        csraService,
        prisonerSearchService,
        manageUsersService,
        prisonApiService,
        activeAgenciesService,
      } as any,
      userSupplier: () => ({ ...user, userRoles: roles }),
    })

  beforeEach(() => {
    jest.clearAllMocks()
    prisonerSearchService.getPrisoner.mockResolvedValue(prisoner)
    manageUsersService.getUserCaseloads.mockResolvedValue({
      username: user.username,
      active: true,
      accountType: 'GENERAL',
      activeCaseload: { id: 'LEI', name: 'Leeds (HMP)' },
      caseloads: [{ id: 'LEI', name: 'Leeds (HMP)' }],
    })
    csraService.startCsraAssessment.mockResolvedValue({ assessmentId: 'assessment-123' })
    csraService.getCsraAssessment.mockResolvedValue(assessment())
    csraService.getCurrentRating.mockResolvedValue({ status: 'NO_RATING', rating: null })
    csraService.getDetailedRating.mockResolvedValue({
      prisonerNumber: prisoner.prisonerNumber,
      reviewId: 'assessment-123',
      prisonName: 'Moorland (HMP & YOI)',
      rating: 'HIGH_SPECIFIC',
      provisionalAssessmentComment: 'Late arrival. PNC and warrant not checked.',
      provisionalDate: '2026-07-06',
      provisionalTime: '21:07:59',
      provisionalCompletedBy: 'DBENTLEY',
    })
    manageUsersService.getUserDetails.mockResolvedValue({ name: 'DAVID BENTLEY' })
    activeAgenciesService.isPrisonActive.mockResolvedValue(true)
    flashProvider.mockReturnValue([])
  })

  describe('review provisional assessment', () => {
    const reviewUrl = `${assessmentUrl}/review-provisional`
    const provisional = () =>
      completeStageAnswers({
        pncChecked: false,
        warrantChecked: false,
        officerSpokeToPrisoner: false,
        likelyToHarmCellmate: true,
        likelyToHarmCellmateDetail: 'Hidden harm detail',
        significantlyVulnerable: true,
        significantlyVulnerableDetail: 'Hidden vulnerability detail',
        causeForConcernSharing: null,
        otherHighRiskIndicators: null,
        seenByHealthcare: false,
        healthcareIncreasedRisk: true,
        healthcareIncreasedRiskDetail: 'Hidden healthcare detail',
      })
    const provisionallyRated = (final?: CsraAssessmentStageAnswers) =>
      assessment({
        interimResult: 'HIGH_SPECIFIC',
        stages: [provisional(), ...(final ? [final] : [])],
      })

    beforeEach(() => {
      csraService.getCsraAssessment.mockResolvedValue(provisionallyRated())
    })

    it('shows the recorded rating details, read-only provisional answers and remaining tasks', async () => {
      csraService.getCsraAssessment.mockResolvedValue(
        provisionallyRated(completeStageAnswers({ stage: 'FINAL', officerSpokeToPrisoner: true })),
      )
      const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .get(reviewUrl)
        .expect(200)
      const text = response.text.replace(/\s+/g, ' ')

      expect(text).toContain('Prison number: A1234BC')
      expect(text).toContain('Date of birth: 3 February 1972')
      expect(text).toContain('Provisional cell sharing risk assessment - John Smith')
      expect(text).toContain('Assessed at Moorland (HMP &amp; YOI) on 6 July 2026 at 21:07')
      expect(text).toContain('High risk – specific (provisional)')
      expect(text).toContain('Late arrival. PNC and warrant not checked.')
      expect(text).toContain('David Bentley')
      expect(text).toContain('Not checked')
      expect(text).toContain('Not answered')
      expect(text).toContain('check remaining evidence sources (PNC, Warrant)')
      expect(text).toContain('review offence questions after checking remaining evidence sources')
      expect(text).toContain('speak to the prisoner about sharing a cell')
      expect(text).toContain('record any observations that cause a cell sharing concern')
      expect(text).toContain('record any other indicators that suggest the prisoner is high risk')
      expect(text).toContain('ensure the prisoner has been seen by healthcare')
      for (const hiddenText of ['Hidden harm detail', 'Hidden vulnerability detail', 'Hidden healthcare detail']) {
        expect(text).not.toContain(hiddenText)
      }
      expect(text).not.toContain('>Change')
      expect(text).not.toContain('Continue to provisional rating')
      expect(text).not.toContain('It will stay provisional')
      expect(response.headers['cache-control']).toBe('private, no-store')
      expect(response.text).toContain('data-revalidate-on-history-restore')
      expect(csraService.getDetailedRating).toHaveBeenCalledWith('user1', 'assessment-123')
      expect(manageUsersService.getUserDetails).toHaveBeenCalledWith('user1', 'DBENTLEY')
      expect(auditService.logPageView).toHaveBeenCalledWith(
        Page.PRISONER_CSRA_REVIEW_PROVISIONAL,
        expect.objectContaining({ who: 'user1', subjectId: 'assessment-123' }),
      )
    })

    it('plays back offence evidence and visible follow-up details using the check-answers rules', async () => {
      const answers = completeStageAnswers({
        offenceArson: true,
        offenceEvidence: [
          { offence: 'ARSON', sources: ['PNC', 'OTHER'], otherSourceDetail: 'Report', details: 'Fire evidence' },
        ],
        likelyToHarmCellmate: true,
        likelyToHarmCellmateDetail: 'Harm detail',
        significantlyVulnerable: true,
        significantlyVulnerableDetail: 'Vulnerability detail',
        healthcareIncreasedRisk: true,
        healthcareIncreasedRiskDetail: 'Healthcare detail',
      })
      csraService.getCsraAssessment.mockResolvedValue(assessment({ interimResult: 'HIGH_SPECIFIC', stages: [answers] }))

      const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .get(reviewUrl)
        .expect(200)
      for (const detail of ['Fire evidence', 'Report', 'Harm detail', 'Vulnerability detail', 'Healthcare detail']) {
        expect(response.text).toContain(detail)
      }
      expect(response.text).not.toContain('Remaining tasks to complete')
      expect(response.text).not.toContain('>Change')
    })

    it.each([undefined, null, false, true])(
      'shows the latest task status for %s and always links to the review page',
      async provisionalReviewed => {
        csraService.getCsraAssessment.mockResolvedValue(
          provisionallyRated(completeStageAnswers({ stage: 'FINAL', provisionalReviewed })),
        )
        const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
          .get(assessmentUrl)
          .expect(200)
        const task = response.text
          .match(/<li class="govuk-task-list__item[\s\S]*?<\/li>/g)
          ?.find(item => item.includes('Review provisional assessment'))

        expect(task).toContain(`href="${reviewUrl}"`)
        const expectedStatus =
          { true: 'Complete', false: 'Incomplete' }[String(provisionalReviewed)] || 'Not yet started'
        expect(task).toContain(expectedStatus)
      },
    )

    it.each([true, false])('preselects the latest saved answer %s', async provisionalReviewed => {
      csraService.getCsraAssessment.mockResolvedValue(
        provisionallyRated(stageAnswers({ stage: 'FINAL', provisionalReviewed })),
      )
      const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .get(reviewUrl)
        .expect(200)
      expect(response.text).toMatch(new RegExp(`value="${provisionalReviewed ? 'YES' : 'NO'}" checked`))
      expect(csraService.updateCsraAssessment).not.toHaveBeenCalled()
    })

    it.each(['YES', 'NO'])(
      'saves %s in the final stage, preserves other answers and updates the latest status',
      async answer => {
        const current = provisionallyRated(
          completeStageAnswers({ stage: 'FINAL', provisionalReviewed: true, version: 5 }),
        )
        csraService.getCsraAssessment.mockResolvedValue(current)
        csraService.updateCsraAssessment.mockImplementationOnce(async (_username, _number, _id, answers) => {
          const updated = { ...current, stages: [current.stages[0], answers] }
          csraService.getCsraAssessment.mockResolvedValue(updated)
          return updated
        })
        const app = buildApp([Role.CSRA__ASSESSMENT_EDIT])
        await request(app)
          .post(reviewUrl)
          .type('form')
          .send({ provisionalReviewed: answer })
          .expect(302)
          .expect('Location', assessmentUrl)
        expect(csraService.updateCsraAssessment).toHaveBeenCalledWith(
          'user1',
          'A1234BC',
          'assessment-123',
          { ...current.stages[1], provisionalReviewed: answer === 'YES' },
          'FINAL',
        )
        expect(current.stages[0]).toEqual(provisional())
        const taskList = await request(app).get(assessmentUrl).expect(200)
        const task = taskList.text
          .match(/<li class="govuk-task-list__item[\s\S]*?<\/li>/g)
          ?.find(item => item.includes('Review provisional assessment'))
        expect(task).toContain(answer === 'YES' ? 'Complete' : 'Incomplete')
        const playback = await request(app).get(reviewUrl).expect(200)
        expect(playback.text).toMatch(new RegExp(`value="${answer}" checked`))
      },
    )

    it('initialises a final stage without prematurely completing the evidence and offences section', async () => {
      const current = provisionallyRated()
      await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .post(reviewUrl)
        .type('form')
        .send({ provisionalReviewed: 'YES' })
        .expect(302)
        .expect('Location', assessmentUrl)
      expect(csraService.updateCsraAssessment).toHaveBeenCalledWith(
        'user1',
        'A1234BC',
        'assessment-123',
        { ...getAnswersFromAssessment(current), prisonId: 'LEI', provisionalReviewed: true },
        'FINAL',
      )
    })

    it.each([{}, { provisionalReviewed: 'invalid' }, { provisionalReviewed: ['YES', 'NO'] }])(
      'rejects missing or invalid answers %j without saving even when an answer was previously saved',
      async body => {
        csraService.getCsraAssessment.mockResolvedValue(
          provisionallyRated(stageAnswers({ stage: 'FINAL', provisionalReviewed: true })),
        )
        const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
          .post(reviewUrl)
          .type('form')
          .send(body)
          .expect(200)
        expect(response.text).toContain('There is a problem')
        expect(response.text).toContain('Select yes if you have reviewed the provisional assessment')
        expect(response.text).toContain('href="#provisionalReviewed"')
        expect(csraService.updateCsraAssessment).not.toHaveBeenCalled()
      },
    )

    it('returns to the task list from Back or Cancel without saving', async () => {
      const app = buildApp([Role.CSRA__ASSESSMENT_EDIT])
      const response = await request(app).get(reviewUrl).expect(200)
      expect(response.text).toContain(`href="${assessmentUrl}" class="govuk-back-link"`)
      expect(response.text).toContain(`href="${assessmentUrl}" class="govuk-link">Cancel</a>`)
      await request(app).get(assessmentUrl).expect(200)
      expect(csraService.updateCsraAssessment).not.toHaveBeenCalled()
    })

    it.each(['get', 'post'] as const)('blocks %s access without the assessor role', async method => {
      await request(buildApp([]))[method](reviewUrl).expect(302).expect('Location', '/sign-out')
      expect(csraService.getDetailedRating).not.toHaveBeenCalled()
      expect(csraService.updateCsraAssessment).not.toHaveBeenCalled()
    })

    it.each(['get', 'post'] as const)('rejects %s access without a provisional rating', async method => {
      csraService.getCsraAssessment.mockResolvedValue(assessment())
      await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        [method](reviewUrl)
        .expect(404)
      expect(csraService.updateCsraAssessment).not.toHaveBeenCalled()
    })

    it('does not show the review row before a provisional rating', async () => {
      csraService.getCsraAssessment.mockResolvedValue(assessment())
      const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .get(assessmentUrl)
        .expect(200)
      expect(response.text).not.toContain('Review provisional assessment')
    })

    it.each(['get', 'post'] as const)('blocks %s after final submission', async method => {
      csraService.getCsraAssessment.mockResolvedValue({ ...provisionallyRated(), finalResult: 'STANDARD' })
      await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        [method](reviewUrl)
        .expect(403)
      expect(csraService.updateCsraAssessment).not.toHaveBeenCalled()
    })

    it('rejects a detailed rating belonging to another prisoner', async () => {
      csraService.getDetailedRating.mockResolvedValue({ prisonerNumber: 'B1234CD', reviewId: 'assessment-123' })
      await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .get(reviewUrl)
        .expect(404)
      expect(manageUsersService.getUserDetails).not.toHaveBeenCalled()
    })

    it.each([undefined, false, true])(
      'gates final-rating routes on the saved review answer %s',
      async provisionalReviewed => {
        csraService.getCsraAssessment.mockResolvedValue(
          provisionallyRated(completeStageAnswers({ stage: 'FINAL', provisionalReviewed })),
        )
        const app = buildApp([Role.CSRA__ASSESSMENT_EDIT])
        const responses = await Promise.all(
          ['/check-answers', '/select-rating', '/confirm-rating/STANDARD'].map(path =>
            request(app).get(`${assessmentUrl}${path}`),
          ),
        )
        for (const response of responses) {
          if (provisionalReviewed === true) {
            expect(response.status).toBe(200)
          } else {
            expect(response.status).toBe(302)
            expect(response.headers.location).toBe(assessmentUrl)
          }
        }
        const confirmation = await request(app)
          .post(`${assessmentUrl}/confirm-rating/STANDARD`)
          .type('form')
          .send({ assessmentComment: 'Final assessment complete' })
          .expect(302)
        if (provisionalReviewed === true) {
          expect(confirmation.headers.location).toBe('/prisoner/A1234BC')
          expect(csraService.submitFinalRating).toHaveBeenCalledWith(
            'user1',
            'A1234BC',
            'assessment-123',
            expect.objectContaining({ provisionalReviewed: true, rating: 'STANDARD' }),
          )
        } else {
          expect(confirmation.headers.location).toBe(assessmentUrl)
          expect(csraService.submitFinalRating).not.toHaveBeenCalled()
        }
      },
    )

    it('surfaces save failures without redirecting as if the review were saved', async () => {
      csraService.updateCsraAssessment.mockRejectedValueOnce(new Error('Unable to save review'))
      const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .post(reviewUrl)
        .type('form')
        .send({ provisionalReviewed: 'YES' })
        .expect(500)
      expect(response.headers.location).toBeUndefined()
    })
  })

  it('blocks CSRA routes when the user lacks permission to edit assessments', async () => {
    await request(buildApp([])).get('/prisoner/A1234BC/csra/start').expect(302).expect('Location', '/sign-out')

    expect(csraService.startCsraAssessment).not.toHaveBeenCalled()
  })

  it('blocks CSRA routes when the prison is inactive, even if the user has the assessment edit role', async () => {
    activeAgenciesService.isPrisonActive.mockResolvedValue(false)

    await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .get('/prisoner/A1234BC/csra/start')
      .expect(302)
      .expect('Location', '/sign-out')

    expect(csraService.startCsraAssessment).not.toHaveBeenCalled()
  })

  it('allows CSRA routes when the user has permission to edit assessments', async () => {
    await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .get('/prisoner/A1234BC/csra/start')
      .expect(302)
      .expect('Location', '/prisoner/A1234BC/csra/assessment-123')

    expect(csraService.startCsraAssessment).toHaveBeenCalledWith('user1', 'A1234BC', undefined)
  })

  it('shows the prison number and a correctly addressed DPS profile link on the task list', async () => {
    const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .get(assessmentUrl)
      .expect(200)
    const banner = response.text.match(/data-qa="prisoner-banner"[\s\S]*?<\/dl>/)?.[0]

    expect(banner).toContain('class="csra-prisoner-banner__number">A1234BC</span>')
    expect(banner).toContain(
      `href="${config.serviceUrls.digitalPrison}/prisoner/A1234BC" target="_blank" data-qa="prisoner-name">John Smith</a>`,
    )
    expect(response.text).toMatch(
      new RegExp(
        `<p class="govuk-body">\\s*<a href="${assessmentUrl}/cancel" class="govuk-link">Cancel this assessment</a>\\s*</p>`,
      ),
    )
  })

  it('shows the configured offence review step with the requested navigation', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      assessment({
        interimResult: 'HIGH_GENERAL',
        stages: [stageAnswers({ stage: 'FINAL', pncChecked: true })],
      }),
    )

    const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .get(`${assessmentUrl}/section/evidenceAndOffences/1`)
      .expect(200)

    expect(response.text).toContain(
      '<h1 class="govuk-heading-l">Review offences after checking new evidence source</h1>',
    )
    expect(response.text).toContain('Check the answers given based on the sources reviewed previously.')
    expect(response.text).toContain('You should update an answer if there is evidence of an offence in the new source.')
    expect(response.text).toContain(`href="${assessmentUrl}/section/evidenceAndOffences/2"`)
    expect(response.text).toContain('Continue')
    expect(response.text).toContain(`href="${assessmentUrl}/section/evidenceAndOffences/0"`)
    expect(response.text).toContain('>Back</a>')
    expect(response.text).toContain(`href="${assessmentUrl}" class="govuk-link">Cancel</a>`)
    expect(csraService.getCsraAssessment).toHaveBeenCalledWith(user.username, prisoner.prisonerNumber, 'assessment-123')
  })

  it('hides the assessment cancel link when a provisional rating has already been entered', async () => {
    csraService.getCsraAssessment.mockResolvedValue(assessment({ interimResult: 'HIGH_GENERAL' }))

    const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .get(assessmentUrl)
      .expect(200)

    expect(response.text).toContain('Provisional assessment')
    expect(response.text).not.toContain('Cancel this assessment')
  })

  it('renders answered-but-incomplete prerequisites as Incomplete and enables the rating link', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      assessment({
        stages: [
          stageAnswers({
            pncChecked: true,
            offenceMurderManslaughter: false,
            offenceAssistingSuicide: false,
            offenceSexualAssault: false,
            offenceRepeatedViolence: false,
            offencePrejudiceMotivated: false,
            offenceArson: false,
            offenceKidnapHostage: false,
            seenByHealthcare: false,
          }),
        ],
      }),
    )

    const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .get(assessmentUrl)
      .expect(200)

    for (const title of ['Evidence sources and offences', 'Healthcare assessment']) {
      const task = response.text
        .match(/<li class="govuk-task-list__item[\s\S]*?<\/li>/g)
        ?.find(item => item.includes(title))
      expect(task).toContain('Incomplete')
      expect(task).toContain('govuk-tag--blue')
      expect(task).not.toContain('Cannot start yet')
    }
    expect(response.text).toContain(`href="${assessmentUrl}/check-answers"`)
  })

  it('redirects from check answers when no rating can be entered', async () => {
    csraService.getCsraAssessment.mockResolvedValue(assessment())

    const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .get(`${assessmentUrl}/check-answers`)
      .expect(302)
      .expect('Location', assessmentUrl)

    expect(response.text).not.toContain('Check answers before you confirm a CSRA rating')
    expect(auditService.logPageView).not.toHaveBeenCalled()
  })

  it('renders the rating choices and no-rating message when no current rating exists', async () => {
    csraService.getCsraAssessment.mockResolvedValue(assessment({ stages: [completeStageAnswers()] }))

    const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .get(`${assessmentUrl}/select-rating`)
      .expect(200)

    expect(response.text).toContain('Select a CSRA rating')
    expect(response.text).toContain('This prisoner does not have a current CSRA rating.')
    expect(response.text).toContain('High risk – general')
    expect(response.text).toContain('High risk – specific')
    expect(response.text).toContain('Standard risk')
    expect(csraService.getCurrentRating).toHaveBeenCalledWith(user.username, prisoner.prisonerNumber)
    expect(auditService.logPageView).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ subjectId: 'assessment-123', subjectType: 'ASSESSMENT_ID' }),
    )
  })

  it('preselects the rating passed back in the query string', async () => {
    csraService.getCsraAssessment.mockResolvedValue(assessment({ stages: [completeStageAnswers()] }))

    const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .get(`${assessmentUrl}/select-rating?selectedRating=HIGH_SPECIFIC`)
      .expect(200)

    expect(response.text).toMatch(/value="HIGH_SPECIFIC"[^>]*checked/)
  })

  it('shows the fixed high-general rating when a clear high-risk offence is recorded', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      assessment({
        stages: [
          completeStageAnswers({
            offenceMurderManslaughter: true,
            offenceEvidence: [{ offence: 'MURDER_MANSLAUGHTER', sources: ['PNC'], details: 'Evidence details' }],
          }),
        ],
      }),
    )

    const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .get(`${assessmentUrl}/select-rating`)
      .expect(200)

    expect(response.text).toContain('The rating must be high risk – general and the prisoner must not share a cell.')
    expect(response.text).toContain('murder, manslaughter or life-threatening assault in custody')
    expect(response.text).not.toContain('name="selectedRating" type="radio"')
  })

  it('renders the page with its validation error when no rating is selected', async () => {
    csraService.getCsraAssessment.mockResolvedValue(assessment({ stages: [completeStageAnswers()] }))

    const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .post(`${assessmentUrl}/select-rating`)
      .type('form')
      .send({})
      .expect(200)

    expect(response.text).toContain('Select a CSRA rating')
    expect(response.text).toContain('This prisoner does not have a current CSRA rating.')
    expect(response.text).toContain('govuk-error-message')
    expect(response.text).toContain('Error:</span> Select a CSRA rating')
  })

  it('rejects a rating that is not one of the available choices', async () => {
    csraService.getCsraAssessment.mockResolvedValue(assessment({ stages: [completeStageAnswers()] }))

    const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .post(`${assessmentUrl}/select-rating`)
      .type('form')
      .send({ selectedRating: 'UNSUPPORTED' })
      .expect(200)

    expect(response.text).toContain('This prisoner does not have a current CSRA rating.')
    expect(response.text).toContain('govuk-error-message')
  })

  it('redirects a valid rating selection to the confirmation step', async () => {
    csraService.getCsraAssessment.mockResolvedValue(assessment({ stages: [completeStageAnswers()] }))

    await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .post(`${assessmentUrl}/select-rating`)
      .type('form')
      .send({ selectedRating: 'HIGH_SPECIFIC' })
      .expect(302)
      .expect('Location', `${assessmentUrl}/confirm-rating/HIGH_SPECIFIC`)
  })

  it('accepts unsuffixed high-risk ratings but not standard while the assessment is incomplete', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      assessment({ stages: [completeStageAnswers({ seenByHealthcare: false })] }),
    )

    await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .post(`${assessmentUrl}/select-rating`)
      .type('form')
      .send({ selectedRating: 'HIGH_SPECIFIC' })
      .expect(302)
      .expect('Location', `${assessmentUrl}/confirm-rating/HIGH_SPECIFIC`)

    const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .post(`${assessmentUrl}/select-rating`)
      .type('form')
      .send({ selectedRating: 'STANDARD' })
      .expect(200)

    expect(response.text).toContain('Provisional CSRA rating')
  })

  it('allows only high-general provisional ratings for an incomplete assessment with a clear high-risk offence', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      assessment({
        stages: [
          completeStageAnswers({
            offenceMurderManslaughter: true,
            offenceEvidence: [{ offence: 'MURDER_MANSLAUGHTER', sources: ['PNC'], details: 'Evidence details' }],
            seenByHealthcare: false,
          }),
        ],
      }),
    )

    await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .post(`${assessmentUrl}/select-rating`)
      .type('form')
      .send({ selectedRating: 'HIGH_GENERAL' })
      .expect(302)
      .expect('Location', `${assessmentUrl}/confirm-rating/HIGH_GENERAL`)

    const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .post(`${assessmentUrl}/select-rating`)
      .type('form')
      .send({ selectedRating: 'HIGH_SPECIFIC' })
      .expect(200)

    expect(response.text).toContain('Provisional CSRA rating')
  })

  it('allows only high-general for a complete assessment with a clear high-risk offence', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      assessment({
        stages: [
          completeStageAnswers({
            offenceMurderManslaughter: true,
            offenceEvidence: [{ offence: 'MURDER_MANSLAUGHTER', sources: ['PNC'], details: 'Evidence details' }],
          }),
        ],
      }),
    )

    const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .post(`${assessmentUrl}/select-rating`)
      .type('form')
      .send({ selectedRating: 'HIGH_SPECIFIC' })
      .expect(200)

    expect(response.text).toContain('The rating must be high risk – general')
  })

  it.each(['get', 'post'] as const)('does not expose the retired confirm-rating %s route', async method => {
    await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      [method](`${assessmentUrl}/confirm-rating`)
      .expect(404)
  })

  describe('rating confirmation', () => {
    const specificRiskFields = {
      riskTo: ['OTHER'],
      RISK_TO_OTHER_DETAILS: 'Specific risk details',
      vulnerabilities: ['MENTAL_HEALTH'],
      VULNERABILITIES_MENTAL_HEALTH_DETAILS: 'Vulnerability details',
    }
    const specificRiskPayload = {
      riskTo: [{ category: 'OTHER', details: 'Specific risk details' }],
      vulnerabilities: [{ category: 'MENTAL_HEALTH', details: 'Vulnerability details' }],
    }

    beforeEach(() => {
      csraService.getCsraAssessment.mockResolvedValue(assessment({ stages: [completeStageAnswers()] }))
    })

    it.each([
      ['HIGH_GENERAL', true],
      ['HIGH_SPECIFIC', true],
      ['STANDARD', false],
    ])('renders final %s with the appropriate review-date field', async (rating, hasReviewDate) => {
      const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .get(`${assessmentUrl}/confirm-rating/${rating}`)
        .expect(200)

      expect(response.text).toContain('Confirm CSRA rating')
      expect(response.text).toContain(`${assessmentUrl}/select-rating?selectedRating=${rating}`)
      expect(response.text.includes('name="nextReviewDate"')).toBe(hasReviewDate)
      expect(response.text).toContain('Assessment comment')
    })

    it.each(['HIGH_GENERAL', 'HIGH_SPECIFIC'])(
      'renders and submits provisional %s without a review date',
      async rating => {
        const answers = completeStageAnswers({ seenByHealthcare: false })
        csraService.getCsraAssessment.mockResolvedValue(assessment({ stages: [answers] }))
        const app = buildApp([Role.CSRA__ASSESSMENT_EDIT])

        const response = await request(app).get(`${assessmentUrl}/confirm-rating/${rating}`).expect(200)

        expect(response.text).toContain('Confirm provisional CSRA rating')
        expect(response.text).toContain('(provisional)')
        expect(response.text).not.toContain('name="nextReviewDate"')

        const isSpecific = rating === 'HIGH_SPECIFIC'
        await request(app)
          .post(`${assessmentUrl}/confirm-rating/${rating}`)
          .type('form')
          .send({
            assessmentComment: 'Awaiting healthcare',
            nextReviewDate: '17/5/2099',
            ...(isSpecific ? specificRiskFields : {}),
          })
          .expect(302)
          .expect('Location', isSpecific ? '/prisoner/A1234BC/rating-confirmed' : '/prisoner/A1234BC')

        expect(csraService.submitProvisionalRating).toHaveBeenCalledWith('user1', 'A1234BC', 'assessment-123', {
          ...answers,
          rating,
          assessmentComment: 'Awaiting healthcare',
          ...(isSpecific ? specificRiskPayload : {}),
        })
        expect(csraService.submitFinalRating).not.toHaveBeenCalled()
        if (isSpecific) {
          expect(flashProvider).not.toHaveBeenCalled()
        } else {
          expect(flashProvider).toHaveBeenCalledWith(
            'success',
            expect.objectContaining({ title: 'Provisional CSRA rating confirmed' }),
          )
        }
      },
    )

    it.each(['HIGH_GENERAL', 'HIGH_SPECIFIC', 'STANDARD'])('submits final %s using the path rating', async rating => {
      const isSpecific = rating === 'HIGH_SPECIFIC'
      await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .post(`${assessmentUrl}/confirm-rating/${rating}`)
        .type('form')
        .send({
          assessmentComment: 'Assessment complete',
          ...(rating.startsWith('HIGH') ? { nextReviewDate: '17/5/2099' } : {}),
          ...(isSpecific ? specificRiskFields : {}),
          rating: 'UNSUPPORTED',
        })
        .expect(302)
        .expect('Location', '/prisoner/A1234BC')

      expect(csraService.submitFinalRating).toHaveBeenCalledWith('user1', 'A1234BC', 'assessment-123', {
        ...completeStageAnswers(),
        rating,
        assessmentComment: 'Assessment complete',
        nextReviewDate: rating.startsWith('HIGH') ? '2099-05-17' : undefined,
        ...(isSpecific ? specificRiskPayload : {}),
      })
      expect(csraService.submitProvisionalRating).not.toHaveBeenCalled()
    })

    it('submits final STANDARD without requiring a review date', async () => {
      await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .post(`${assessmentUrl}/confirm-rating/STANDARD`)
        .type('form')
        .send({ assessmentComment: 'Assessment complete' })
        .expect(302)

      expect(csraService.submitFinalRating).toHaveBeenCalledWith(
        'user1',
        'A1234BC',
        'assessment-123',
        expect.objectContaining({ rating: 'STANDARD', nextReviewDate: undefined }),
      )
    })

    it('renders required errors rather than submitting an empty high-specific confirmation', async () => {
      const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .post(`${assessmentUrl}/confirm-rating/HIGH_SPECIFIC`)
        .type('form')
        .send({ assessmentComment: '   ' })
        .expect(200)

      expect(response.text).toContain('Select who this person is a risk to')
      expect(response.text).toContain('Select whether this person is part of a vulnerable or at risk group')
      expect(response.text).toContain('Enter or select a date')
      expect(response.text).toContain('href="#riskTo"')
      expect(response.text).toContain('href="#vulnerabilities"')
      expect(response.text).toContain('href="#nextReviewDate"')
      expect(csraService.submitFinalRating).not.toHaveBeenCalled()
    })

    it('rejects high-specific categories that are missing details or are unsupported', async () => {
      const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .post(`${assessmentUrl}/confirm-rating/HIGH_SPECIFIC`)
        .type('form')
        .send({
          assessmentComment: 'Assessment complete',
          nextReviewDate: '17/5/2099',
          riskTo: ['OTHER', 'UNSUPPORTED'],
          vulnerabilities: ['NONE', 'MENTAL_HEALTH'],
        })
        .expect(200)

      expect(response.text).toContain('Enter details of who this person is a risk to')
      expect(response.text).toContain('Enter details of why this person is vulnerable or at risk')
      expect(csraService.submitFinalRating).not.toHaveBeenCalled()
      expect(csraService.submitProvisionalRating).not.toHaveBeenCalled()
    })

    it('renders required errors rather than submitting an empty high-general confirmation', async () => {
      const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .post(`${assessmentUrl}/confirm-rating/HIGH_GENERAL`)
        .type('form')
        .send({ assessmentComment: '   ' })
        .expect(200)

      expect(response.text).toContain('Enter an assessment comment')
      expect(response.text).toContain('Enter or select a date')
      expect(response.text).toContain('href="#assessmentComment"')
      expect(response.text).toContain('href="#nextReviewDate"')
      expect(csraService.submitFinalRating).not.toHaveBeenCalled()
      expect(flashProvider).not.toHaveBeenCalledWith('success', expect.anything())
    })

    it.each([
      ['2026-05-17', 'Enter the date in the correct format'],
      ['17/5', 'Enter a full date'],
      ['31/2/2099', 'Enter a real date'],
      ['1/1/2000', 'Select an available date from the calendar'],
    ])('rejects review date %s and preserves the comment and date', async (nextReviewDate, error) => {
      const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .post(`${assessmentUrl}/confirm-rating/HIGH_GENERAL`)
        .type('form')
        .send({ assessmentComment: 'Keep this assessment comment', nextReviewDate })
        .expect(200)

      expect(response.text).toContain(error)
      expect(response.text).toContain('Keep this assessment comment')
      expect(response.text).toContain(`value="${nextReviewDate}"`)
      expect(csraService.submitFinalRating).not.toHaveBeenCalled()
    })

    describe.each(['get', 'post'] as const)('%s guards', method => {
      it.each(['UNSUPPORTED', 'HIGH_GENERAL_PROVISIONAL'])('redirects unsupported rating %s', async rating => {
        await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
          [method](`${assessmentUrl}/confirm-rating/${rating}`)
          .expect(302)
          .expect('Location', assessmentUrl)

        expect(csraService.submitProvisionalRating).not.toHaveBeenCalled()
        expect(csraService.submitFinalRating).not.toHaveBeenCalled()
      })

      it('rejects standard for a provisional assessment', async () => {
        csraService.getCsraAssessment.mockResolvedValue(
          assessment({ stages: [completeStageAnswers({ seenByHealthcare: false })] }),
        )

        await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
          [method](`${assessmentUrl}/confirm-rating/STANDARD`)
          .expect(302)
          .expect('Location', assessmentUrl)

        expect(csraService.submitFinalRating).not.toHaveBeenCalled()
        expect(csraService.submitProvisionalRating).not.toHaveBeenCalled()
      })

      it('rejects high-specific when an offence requires high-general', async () => {
        csraService.getCsraAssessment.mockResolvedValue(
          assessment({
            stages: [
              completeStageAnswers({
                offenceMurderManslaughter: true,
                offenceEvidence: [{ offence: 'MURDER_MANSLAUGHTER', sources: ['PNC'], details: 'Evidence' }],
              }),
            ],
          }),
        )

        await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
          [method](`${assessmentUrl}/confirm-rating/HIGH_SPECIFIC`)
          .expect(302)
          .expect('Location', assessmentUrl)

        expect(csraService.submitFinalRating).not.toHaveBeenCalled()
      })

      it('redirects when there are incomplete prerequisites', async () => {
        csraService.getCsraAssessment.mockResolvedValue(assessment())

        await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
          [method](`${assessmentUrl}/confirm-rating/HIGH_GENERAL`)
          .expect(302)
          .expect('Location', assessmentUrl)

        expect(csraService.submitFinalRating).not.toHaveBeenCalled()
        expect(csraService.submitProvisionalRating).not.toHaveBeenCalled()
      })

      it('shows the submitted-assessment page when a final result exists', async () => {
        csraService.getCsraAssessment.mockResolvedValue(assessment({ finalResult: 'STANDARD' }))

        const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
          [method](`${assessmentUrl}/confirm-rating/HIGH_GENERAL`)
          .expect(403)

        expect(response.text).toContain('<h1 class="govuk-heading-l">You cannot access this page</h1>')
        expect(response.text).toContain(
          'The assessment has already been submitted. You cannot go back to change your answers.',
        )
        expect(response.text).toContain(
          '<a class="govuk-link" href="/prisoner/A1234BC">Return to Cell sharing risk assessments (CSRA)</a>',
        )
        expect(csraService.submitFinalRating).not.toHaveBeenCalled()
        expect(csraService.submitProvisionalRating).not.toHaveBeenCalled()
      })
    })
  })

  it('renders a back link to the task list and a paragraph-wrapped cancel link on the first question', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      assessment({ stages: [stageAnswers({ officerSpokeToPrisoner: true })] }),
    )

    const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .get(`${assessmentUrl}/section/conversationAndVulnerability`)
      .expect(200)

    expect(response.text).toContain('Has an officer spoken with the prisoner about sharing a cell?')
    expect(response.text).toContain(`href="${assessmentUrl}" class="govuk-back-link"`)
    expect(response.text).toMatch(
      new RegExp(`<p class="govuk-body">\\s*<a class="govuk-link" href="${assessmentUrl}">Cancel</a>\\s*</p>`),
    )
  })

  it('blocks direct access to a submitted assessment question and prevents answer changes', async () => {
    csraService.getCsraAssessment.mockResolvedValue(assessment({ finalResult: 'STANDARD' }))

    const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .post(`${assessmentUrl}/section/conversationAndVulnerability/0`)
      .type('form')
      .send({ officerSpokeToPrisoner: 'true' })
      .expect(403)

    expect(response.headers['cache-control']).toBe('private, no-store')
    expect(response.text).toContain('<h1 class="govuk-heading-l">You cannot access this page</h1>')
    expect(response.text).toContain(
      '<a class="govuk-link" href="/prisoner/A1234BC">Return to Cell sharing risk assessments (CSRA)</a>',
    )
    expect(csraService.updateCsraAssessment).not.toHaveBeenCalled()
  })

  it.each(['/section/conversationAndVulnerability/0', '/check-answers', '/select-rating', '/confirm-rating/STANDARD'])(
    'disables HTTP caching and enables history revalidation on %s',
    async path => {
      csraService.getCsraAssessment.mockResolvedValue(assessment({ stages: [completeStageAnswers()] }))

      const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .get(`${assessmentUrl}${path}`)
        .expect(200)

      expect(response.headers['cache-control']).toBe('private, no-store')
      expect(response.text).toContain('data-revalidate-on-history-restore')
    },
  )

  it('renders a back link to the preceding answered question', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      assessment({ stages: [stageAnswers({ officerSpokeToPrisoner: true })] }),
    )

    const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .get(`${assessmentUrl}/section/conversationAndVulnerability/1`)
      .expect(200)

    expect(response.text).toContain(
      `href="${assessmentUrl}/section/conversationAndVulnerability/0" class="govuk-back-link"`,
    )
  })

  it.each([false, true])(
    'requires another evidence walkthrough after each added source (last offence: %s)',
    async offenceKidnapHostage => {
      const provisional = completeStageAnswers({
        warrantChecked: false,
        perChecked: false,
        offenceKidnapHostage,
        offenceEvidence: offenceKidnapHostage
          ? [{ offence: 'KIDNAP_HOSTAGE', sources: ['PNC'], details: 'Provisional evidence' }]
          : [],
      })
      const original = structuredClone(provisional)
      let current = assessment({
        interimResult: 'HIGH_GENERAL',
        stages: [provisional, { ...structuredClone(provisional), stage: 'FINAL', provisionalReviewed: true }],
      })
      csraService.getCsraAssessment.mockImplementation(async () => current)
      csraService.updateCsraAssessment.mockImplementation(
        async (_username, _prisonerNumber, _assessmentId, answers: CsraAssessmentStageAnswers) => {
          current = { ...current, stages: [provisional, { ...answers, version: answers.version + 1 }] }
          return current
        },
      )
      const app = buildApp([Role.CSRA__ASSESSMENT_EDIT])
      const sectionUrl = `${assessmentUrl}/section/evidenceAndOffences`
      const { steps } = flowConfig.evidenceAndOffences
      const expectTaskStatus = async (status: string) => {
        const page = await request(app).get(assessmentUrl).expect(200)
        const task = page.text
          .match(/<li class="govuk-task-list__item[\s\S]*?<\/li>/g)
          .find(item => item.includes('Evidence sources and offences'))
        expect(task).toContain(status)
      }

      /* eslint-disable no-await-in-loop -- Follow redirects using the answers persisted by each submission. */
      for (const sources of [['warrantChecked'], ['warrantChecked', 'perChecked']]) {
        const previousAnswers = structuredClone(getAnswersFromAssessment(current))
        const saved = await request(app)
          .post(`${sectionUrl}/0`)
          .type('form')
          .send({ evidenceSources: sources })
          .expect(302)

        expect(getAnswersFromAssessment(current)).toEqual({
          ...previousAnswers,
          warrantChecked: true,
          perChecked: sources.includes('perChecked'),
          offenceEvidenceReviewed: false,
          version: previousAnswers.version + 1,
        })

        // Visiting the next page and cancelling must not count as a submission.
        const calls = csraService.updateCsraAssessment.mock.calls.length
        const review = await request(app).get(saved.headers.location).expect(200)
        expect(review.text).toContain(`href="${assessmentUrl}"`)
        await expectTaskStatus('Incomplete')
        await request(app).get(`${assessmentUrl}/check-answers`).expect(302).expect('Location', assessmentUrl)
        expect(csraService.updateCsraAssessment).toHaveBeenCalledTimes(calls)

        const restart = await request(app)
          .post(`${sectionUrl}/0`)
          .type('form')
          .send({ evidenceSources: sources })
          .expect(302)
        let nextUrl = restart.headers.location
        let submittedQuestions = 0
        while (nextUrl !== assessmentUrl) {
          const stepId = Number(nextUrl.split('/').at(-1))
          const step = steps[stepId]
          const answers = getAnswersFromAssessment(current)
          expect(answers.offenceEvidenceReviewed).toBe(false)
          const page = await request(app).get(nextUrl).expect(200)
          const values = step.getFormValues(answers)
          for (const [field, value] of Object.entries(values)) {
            if (value === 'YES' || value === 'NO') {
              expect(page.text).toMatch(new RegExp(`name="${field}"[^>]*value="${value}"[^>]*checked`))
            }
          }
          if (step === steps.at(-1) && offenceKidnapHostage) {
            expect(page.text).toContain(answers.offenceEvidence[0].details)
            await request(app).post(nextUrl).type('form').send({}).expect(200)
            expect(getAnswersFromAssessment(current).offenceEvidenceReviewed).toBe(false)
            // The second walkthrough must show the details saved during the first.
            if (sources.length === 1) {
              const detailsId = step.questions[1].id
              values[detailsId] = 'Updated final evidence'
            } else {
              expect(page.text).toContain('Updated final evidence')
            }
          }
          const result = await request(app).post(nextUrl).type('form').send(values).expect(302)
          nextUrl = result.headers.location
          if (!(step instanceof InformationStep)) submittedQuestions += 1
          expect(getAnswersFromAssessment(current).offenceEvidenceReviewed).toBe(nextUrl === assessmentUrl)
        }
        expect(submittedQuestions).toBe(offenceKidnapHostage ? 7 : 6)
        await expectTaskStatus(sources.length === 2 ? 'Complete' : 'Incomplete')
      }
      /* eslint-enable no-await-in-loop */
      await request(app).get(`${assessmentUrl}/check-answers`).expect(200)
      expect(provisional).toEqual(original)
    },
  )

  it('shows checked and remaining evidence sources separately after a provisional rating', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      assessment({
        interimResult: 'HIGH_GENERAL',
        stages: [stageAnswers({ pncChecked: true, dpsChecked: true }), stageAnswers({ stage: 'FINAL' })],
      }),
    )

    const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .get(`${assessmentUrl}/section/evidenceAndOffences/0`)
      .expect(200)

    expect(response.text).toContain('Evidence sources already checked')
    expect(response.text).toContain('Which remaining evidence sources have you checked?')
    expect(response.text).toMatch(
      /<li>\s*PNC\s*<div class="govuk-hint">\s*Current and previous convictions\s*<\/div>\s*<\/li>/,
    )
    expect(response.text).toMatch(
      /<li>\s*DPS\s*<div class="govuk-hint">\s*Current and historical adjudications\s*<\/div>\s*<\/li>/,
    )
    expect(response.text).not.toContain('You must review all evidence sources')
    expect(response.text).not.toContain('value="pncChecked"')
    expect(response.text).not.toContain('value="dpsChecked"')
    expect(response.text).toContain('value="warrantChecked"')
    expect(response.text).toContain('value="perChecked"')
  })

  it('uses zero-based step ids for check answers change links and displays unanswered values explicitly', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      assessment({
        stages: [
          stageAnswers({
            pncChecked: true,
            dpsChecked: true,
            perChecked: true,
            warrantChecked: true,
            offenceMurderManslaughter: false,
            offenceAssistingSuicide: false,
            offenceSexualAssault: false,
            offenceRepeatedViolence: false,
            offencePrejudiceMotivated: false,
            offenceArson: false,
            offenceKidnapHostage: false,
            seenByHealthcare: true,
            healthcareIncreasedRisk: false,
            officerSpokeToPrisoner: true,
            likelyToHarmCellmate: false,
          }),
        ],
      }),
    )

    const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .get(`${assessmentUrl}/check-answers`)
      .expect(200)
    const rows = response.text.match(/<div class="govuk-summary-list__row">[\s\S]*?<\/div>/g) ?? []

    for (const [sectionId, stepId, questionId, answer] of [
      ['evidenceAndOffences', 2, 'offenceMurderManslaughter', 'No'],
      ['evidenceAndOffences', 2, 'offenceAssistingSuicide', 'No'],
      ['evidenceAndOffences', 5, 'offenceSexualAssault', 'No'],
      ['conversationAndVulnerability', 0, 'officerSpokeToPrisoner', 'Yes'],
      ['conversationAndVulnerability', 1, 'likelyToHarmCellmate', 'No'],
      ['conversationAndVulnerability', 2, 'significantlyVulnerable', 'Not answered'],
      ['observation', 0, 'causeForConcernSharing', 'Not answered'],
      ['otherRisks', 0, 'otherHighRiskIndicators', 'Not answered'],
      ['healthcare', 0, 'seenByHealthcare', 'Yes'],
      ['healthcare', 1, 'healthcareIncreasedRisk', 'No'],
    ] as const) {
      const question = flowConfig[sectionId].steps[stepId].questions.find(q => q.id === questionId)
      const row = rows.find(item => item.includes(question.question))
      expect(row).toContain(`href="${assessmentUrl}/section/${sectionId}/${stepId}"`)
      expect(row).toMatch(new RegExp(`govuk-summary-list__value">\\s*${answer}\\s*</dd>`))
    }
    expect(response.text).not.toContain('Which evidence sources have you checked?')
    expect(response.text).not.toContain('Provide details of the evidence')
    expect(response.text).not.toContain('Where did you find evidence of')
    for (const source of ['DPS', 'PER', 'Warrant', 'PNC']) {
      const row = rows.find(item => new RegExp(`govuk-summary-list__key">\\s*${source}\\s*</dt>`).test(item))
      expect(row).toContain(`href="${assessmentUrl}/section/evidenceAndOffences/0"`)
      expect(row).toContain('Checked')
    }
  })

  it('renders offence evidence with formatted sources and escaped details', async () => {
    const evidenceDetails = '<script>previous arson</script>'
    const otherSourceDetails = '<script>local archive</script>'
    csraService.getCsraAssessment.mockResolvedValue(
      assessment({
        stages: [
          stageAnswers({
            pncChecked: true,
            dpsChecked: true,
            perChecked: true,
            warrantChecked: true,
            offenceMurderManslaughter: false,
            offenceAssistingSuicide: false,
            offenceSexualAssault: false,
            offenceRepeatedViolence: false,
            offencePrejudiceMotivated: false,
            offenceArson: true,
            offenceKidnapHostage: false,
            offenceEvidence: [
              {
                offence: 'ARSON',
                sources: ['PNC', 'WARRANT', 'OTHER'],
                otherSourceDetail: otherSourceDetails,
                details: evidenceDetails,
              },
            ],
            officerSpokeToPrisoner: true,
            likelyToHarmCellmate: true,
            likelyToHarmCellmateDetail: 'Threatened to assault a cellmate.',
            significantlyVulnerable: true,
            significantlyVulnerableDetail: 'Requires protection.',
            causeForConcernSharing: true,
            causeForConcernSharingDetail: '<script>observed altercation</script>',
            otherHighRiskIndicators: true,
            otherHighRiskIndicatorsDetail: 'Has made repeated threats.',
            seenByHealthcare: false,
          }),
        ],
      }),
    )

    const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .get(`${assessmentUrl}/check-answers`)
      .expect(200)

    expect(response.text).toContain('Arson or fire setting')
    expect(response.text).toContain('&lt;script&gt;previous arson&lt;/script&gt;')
    expect(response.text).toContain('PNC, Warrant, and Other')
    expect(response.text).toContain('&lt;script&gt;local archive&lt;/script&gt;')
    expect(response.text).toContain('Threatened to assault a cellmate.')
    expect(response.text).toContain('Requires protection.')
    expect(response.text).toContain('&lt;script&gt;observed altercation&lt;/script&gt;')
    expect(response.text).toContain('Has made repeated threats.')
    expect(response.text).not.toContain(evidenceDetails)
    const arsonStepId = flowConfig.evidenceAndOffences.steps.findIndex(step =>
      step.questions.some(question => question.id === 'offenceArson'),
    )
    expect(response.text).toContain(`href="${assessmentUrl}/section/evidenceAndOffences/${arsonStepId}"`)
    expect(response.text).toContain('Continue to provisional rating')
  })

  describe('cancel assessment', () => {
    it('renders the answers summary without change links and the confirmation radios', async () => {
      csraService.getCsraAssessment.mockResolvedValue(assessment({ stages: [stageAnswers({ pncChecked: true })] }))

      const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .get(`${assessmentUrl}/cancel`)
        .expect(200)

      expect(response.text).toContain('Evidence sources')
      expect(response.text).not.toContain(`href="${assessmentUrl}/section/`)
      expect(response.text).toContain('Are you sure you want to cancel this assessment?')
      expect(response.text).not.toContain('Select yes if you want to cancel this assessment')
      expect(response.text).toContain(`href="${assessmentUrl}" class="govuk-back-link"`)
      expect(response.text).toMatch(
        new RegExp(`<p class="govuk-body">\\s*<a class="govuk-link" href="${assessmentUrl}">Cancel</a>\\s*</p>`),
      )
    })

    it('redirects back to the cancel page with a flashed error when no option is selected', async () => {
      await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .post(`${assessmentUrl}/cancel`)
        .type('form')
        .send({})
        .expect(302)
        .expect('Location', `${assessmentUrl}/cancel`)

      expect(flashProvider).toHaveBeenCalledWith(
        'confirmCancelError',
        'Select yes if you want to cancel this assessment',
      )
      expect(csraService.getCsraAssessment).not.toHaveBeenCalled()
      expect(csraService.cancelCsraAssessment).not.toHaveBeenCalled()
    })

    it('shows the flashed error on the cancel page', async () => {
      flashProvider.mockReturnValue(['Select yes if you want to cancel this assessment'])

      const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .get(`${assessmentUrl}/cancel`)
        .expect(200)

      expect(flashProvider).toHaveBeenCalledWith('confirmCancelError')
      expect(response.text).toContain('There is a problem')
      expect(response.text).toContain('href="#confirmCancel"')
      expect(response.text).toContain('Select yes if you want to cancel this assessment')
    })

    it('returns to the task list when no is selected', async () => {
      await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .post(`${assessmentUrl}/cancel`)
        .type('form')
        .send({ confirmCancel: 'no' })
        .expect(302)
        .expect('Location', assessmentUrl)

      expect(csraService.cancelCsraAssessment).not.toHaveBeenCalled()
    })

    it('cancels the assessment and shows the success page when yes is selected', async () => {
      csraService.cancelCsraAssessment.mockResolvedValue({ prisonerNumber: 'A1234BC', status: 'NO_RATING' })

      await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .post(`${assessmentUrl}/cancel`)
        .type('form')
        .send({ confirmCancel: 'yes' })
        .expect(302)
        .expect('Location', `${assessmentUrl}/cancelled`)

      expect(csraService.cancelCsraAssessment).toHaveBeenCalledWith('user1', 'A1234BC', 'assessment-123', undefined)
      expect(csraService.getCsraAssessment).not.toHaveBeenCalled()
    })

    it('renders the cancelled confirmation panel with a finish button', async () => {
      const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .get(`${assessmentUrl}/cancelled`)
        .expect(200)

      expect(response.text).toContain('govuk-panel--confirmation')
      expect(response.text).toContain('Assessment cancelled')
      expect(response.text).toContain('You have cancelled a cell sharing risk assessment for John Smith')
      expect(response.text).toContain('You can start a new assessment for this prisoner if required.')
      expect(response.text).toMatch(/href="\/prisoner\/A1234BC"[^>]*data-qa="finish-button"/)
      expect(csraService.getCsraAssessment).not.toHaveBeenCalled()
    })

    it.each(['CsraAssessmentNotCancellable', 'CsraReviewNotWritable'])(
      'shows the error page with a 409 when the API rejects the cancellation with %s',
      async errorCode => {
        csraService.cancelCsraAssessment.mockRejectedValue({
          responseStatus: 409,
          data: { status: 409, errorCode },
        })

        const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
          .post(`${assessmentUrl}/cancel`)
          .type('form')
          .send({ confirmCancel: 'yes' })
          .expect(409)

        expect(response.text).toContain(`cannot be cancelled: ${errorCode}`)
      },
    )

    it('shows not found when the assessment does not exist', async () => {
      csraService.cancelCsraAssessment.mockRejectedValue({ responseStatus: 404 })

      await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .post(`${assessmentUrl}/cancel`)
        .type('form')
        .send({ confirmCancel: 'yes' })
        .expect(404)
    })

    it('passes other errors on', async () => {
      csraService.cancelCsraAssessment.mockRejectedValue({ responseStatus: 500 })

      await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .post(`${assessmentUrl}/cancel`)
        .type('form')
        .send({ confirmCancel: 'yes' })
        .expect(500)
    })
  })
})

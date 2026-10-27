import request from 'supertest'

import { appWithAllRoutes, flashProvider, user } from './testutils/appSetup'
import type { Prisoner } from '../data/prisonerSearchApiTypes'
import type { CsraAssessment, CsraAssessmentStageAnswers } from '../data/csraApiTypes'
import { Role } from '../utils/roles'
import flowConfig from '../lib/transactionFlow/config'
import config from '../config'

const prisoner: Prisoner = {
  prisonerNumber: 'A1234BC',
  firstName: 'JOHN',
  lastName: 'SMITH',
  prisonId: 'LEI',
  prisonName: 'Leeds (HMP)',
}

const assessmentUrl = '/prisoner/A1234BC/csra/assessment-123'

const stageAnswers = (overrides: Partial<CsraAssessmentStageAnswers> = {}): CsraAssessmentStageAnswers => ({
  stage: 'PROVISIONAL',
  prisonId: 'LEI',
  offenceEvidence: [],
  riskTo: [],
  vulnerabilities: [],
  version: 1,
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
    updateCsraAssessment: jest.fn(),
    getCurrentRating: jest.fn(),
    startCsraAssessment: jest.fn(),
    cancelCsraAssessment: jest.fn(),
    submitProvisionalRating: jest.fn().mockResolvedValue({}),
    submitFinalRating: jest.fn().mockResolvedValue({}),
  }
  const prisonerSearchService = {
    getPrisoner: jest.fn(),
  }
  const manageUsersService = {
    getUserCaseloads: jest.fn(),
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
    activeAgenciesService.isPrisonActive.mockResolvedValue(true)
    flashProvider.mockReturnValue([])
  })

  it('blocks CSRA routes when the user lacks permission to edit assessments', async () => {
    await request(buildApp([])).get('/prisoner/A1234BC/csra/start').expect(302).expect('Location', '/sign-out')

    expect(csraService.startCsraAssessment).not.toHaveBeenCalled()
  })

  describe('evidence sources', () => {
    const evidenceUrl = `${assessmentUrl}/section/evidenceAndOffences/0`

    it('shows guidance and all sources during the initial assessment', async () => {
      const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .get(evidenceUrl)
        .expect(200)

      expect(response.text).toContain('You must review all evidence sources')
      expect(response.text).toContain('If you are unable to check all sources')
      expect(response.text).toContain('Which evidence sources have you checked?')
      expect(response.text).not.toContain('Evidence sources already checked')
      for (const source of ['pncChecked', 'warrantChecked', 'dpsChecked', 'perChecked']) {
        expect(response.text).toContain(`value="${source}"`)
      }
    })

    it('shows the provisional baseline as a list and later checks as editable checkboxes on revisit', async () => {
      const provisional = stageAnswers({ pncChecked: true, warrantChecked: true })
      const final = stageAnswers({
        stage: 'FINAL',
        pncChecked: true,
        warrantChecked: true,
        dpsChecked: true,
        version: 4,
      })
      csraService.getCsraAssessment.mockResolvedValue(
        assessment({ interimResult: 'HIGH_GENERAL', stages: [provisional, final] }),
      )

      const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .get(evidenceUrl)
        .expect(200)

      expect(response.text).not.toContain('You must review all')
      expect(response.text).not.toContain('If you are unable to check')
      expect(response.text).toContain('Evidence sources already checked')
      expect(response.text).toMatch(
        /<li>\s*PNC\s*<div class="govuk-hint">\s*Current and previous convictions\s*<\/div>\s*<\/li>/,
      )
      expect(response.text).toMatch(
        /<li>\s*Warrant\s*<div class="govuk-hint">\s*Current charge or offence\s*<\/div>\s*<\/li>/,
      )
      expect(response.text).toContain('Which remaining evidence sources have you checked?')
      expect(response.text).not.toContain('value="pncChecked"')
      expect(response.text).not.toContain('value="warrantChecked"')
      expect(response.text).toMatch(/value="dpsChecked" checked/)
      expect(response.text).toContain('value="perChecked"')
    })

    it('saves a new final stage without requiring an additional selection or changing the baseline', async () => {
      const provisional = stageAnswers({ pncChecked: true, version: 7 })
      const original = structuredClone(provisional)
      csraService.getCsraAssessment.mockResolvedValue(
        assessment({ interimResult: 'HIGH_GENERAL', stages: [provisional] }),
      )
      csraService.updateCsraAssessment.mockResolvedValue(
        assessment({ interimResult: 'HIGH_GENERAL', stages: [provisional, { ...provisional, stage: 'FINAL' }] }),
      )

      await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .post(evidenceUrl)
        .send({})
        .expect(302)
        .expect('Location', `${assessmentUrl}/section/evidenceAndOffences/1`)

      expect(csraService.updateCsraAssessment).toHaveBeenCalledWith(
        'user1',
        prisoner.prisonerNumber,
        'assessment-123',
        expect.objectContaining({
          stage: 'FINAL',
          pncChecked: true,
          warrantChecked: false,
          dpsChecked: false,
          perChecked: false,
          version: 1,
        }),
      )
      expect(provisional).toEqual(original)
    })

    it('shows only the checked list when every source was checked provisionally', async () => {
      csraService.getCsraAssessment.mockResolvedValue(
        assessment({ interimResult: 'HIGH_GENERAL', stages: [completeStageAnswers()] }),
      )

      const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .get(evidenceUrl)
        .expect(200)

      expect(response.text).toContain('Evidence sources already checked')
      expect(response.text).not.toContain('Which remaining evidence sources')
      expect(response.text).not.toContain('type="checkbox"')
      expect(response.text).toContain('Save and continue')
      expect(response.text).toMatch(
        /<li>\s*DPS\s*<div class="govuk-hint">\s*Current and historical adjudications\s*<\/div>\s*<\/li>/,
      )
      expect(response.text).toMatch(
        /<li>\s*PER\s*<div class="govuk-hint">\s*Violent behaviours in prison, court or PECS custody\s*<\/div>\s*<\/li>/,
      )
    })

    it('saves corrected final selections using the final version and keeps unrelated answers', async () => {
      const provisional = stageAnswers({ pncChecked: true, version: 7 })
      const final = stageAnswers({
        stage: 'FINAL',
        pncChecked: true,
        dpsChecked: true,
        officerSpokeToPrisoner: true,
        likelyToHarmCellmate: false,
        version: 4,
      })
      const saved = { ...final, dpsChecked: false, warrantChecked: false, perChecked: true, version: 5 }
      const original = structuredClone(provisional)
      const existingAssessment = assessment({ interimResult: 'HIGH_GENERAL', stages: [provisional, final] })
      csraService.getCsraAssessment.mockResolvedValue(existingAssessment)
      csraService.updateCsraAssessment.mockResolvedValue({ ...existingAssessment, stages: [provisional, saved] })

      const app = buildApp([Role.CSRA__ASSESSMENT_EDIT])
      await request(app)
        .post(evidenceUrl)
        .send({ evidenceSources: ['perChecked'], pncChecked: false })
        .expect(302)
        .expect('Location', `${assessmentUrl}/section/evidenceAndOffences/1`)

      expect(csraService.updateCsraAssessment).toHaveBeenCalledWith(
        'user1',
        prisoner.prisonerNumber,
        'assessment-123',
        { ...saved, version: 4 },
      )
      expect(provisional).toEqual(original)

      csraService.getCsraAssessment.mockResolvedValue({ ...existingAssessment, stages: [provisional, saved] })
      const response = await request(app).get(evidenceUrl).expect(200)
      expect(response.text).toMatch(/value="perChecked" checked/)
      expect(response.text).not.toMatch(/value="dpsChecked" checked/)
      expect(response.text).not.toContain('value="pncChecked"')
      expect(response.text).not.toMatch(/<li>\s*PER\s/)
    })
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
    beforeEach(() => {
      csraService.getCsraAssessment.mockResolvedValue(assessment({ stages: [completeStageAnswers()] }))
    })

    it.each([
      ['HIGH_GENERAL', true],
      ['HIGH_SPECIFIC', false],
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

        await request(app)
          .post(`${assessmentUrl}/confirm-rating/${rating}`)
          .type('form')
          .send({ assessmentComment: 'Awaiting healthcare', nextReviewDate: '17/5/2099' })
          .expect(302)
          .expect('Location', '/prisoner/A1234BC')

        expect(csraService.submitProvisionalRating).toHaveBeenCalledWith('user1', 'A1234BC', 'assessment-123', {
          ...answers,
          rating,
          assessmentComment: 'Awaiting healthcare',
        })
        expect(csraService.submitFinalRating).not.toHaveBeenCalled()
        expect(flashProvider).toHaveBeenCalledWith(
          'success',
          expect.objectContaining({ title: 'CSRA rating confirmed' }),
        )
      },
    )

    it.each(['HIGH_GENERAL', 'HIGH_SPECIFIC', 'STANDARD'])('submits final %s using the path rating', async rating => {
      await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .post(`${assessmentUrl}/confirm-rating/${rating}`)
        .type('form')
        .send({
          assessmentComment: 'Assessment complete',
          ...(rating === 'HIGH_GENERAL' ? { nextReviewDate: '17/5/2099' } : {}),
          rating: 'UNSUPPORTED',
        })
        .expect(302)
        .expect('Location', '/prisoner/A1234BC')

      expect(csraService.submitFinalRating).toHaveBeenCalledWith('user1', 'A1234BC', 'assessment-123', {
        ...completeStageAnswers(),
        rating,
        assessmentComment: 'Assessment complete',
        nextReviewDate: rating === 'HIGH_GENERAL' ? '2099-05-17' : undefined,
      })
      expect(csraService.submitProvisionalRating).not.toHaveBeenCalled()
    })

    it.each(['HIGH_SPECIFIC', 'STANDARD'])('submits final %s without requiring a review date', async rating => {
      await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
        .post(`${assessmentUrl}/confirm-rating/${rating}`)
        .type('form')
        .send({ assessmentComment: 'Assessment complete' })
        .expect(302)

      expect(csraService.submitFinalRating).toHaveBeenCalledWith(
        'user1',
        'A1234BC',
        'assessment-123',
        expect.objectContaining({ rating, nextReviewDate: undefined }),
      )
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

      it.each(['incomplete prerequisites', 'final result'])('redirects when there are %s', async state => {
        csraService.getCsraAssessment.mockResolvedValue(
          state === 'final result' ? assessment({ finalResult: 'STANDARD' }) : assessment(),
        )

        await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
          [method](`${assessmentUrl}/confirm-rating/HIGH_GENERAL`)
          .expect(302)
          .expect('Location', assessmentUrl)

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

  it('uses zero-based step ids for check answers change links and displays unanswered values explicitly', async () => {
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
      ['evidenceAndOffences', 1, 'offenceMurderManslaughter', 'No'],
      ['evidenceAndOffences', 1, 'offenceAssistingSuicide', 'No'],
      ['evidenceAndOffences', 4, 'offenceSexualAssault', 'No'],
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
      expect(row).toContain(source === 'PNC' ? 'Checked' : 'Not checked')
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

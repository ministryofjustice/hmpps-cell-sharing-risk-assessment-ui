import request from 'supertest'

import { appWithAllRoutes, user } from './testutils/appSetup'
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
    startCsraAssessment: jest.fn(),
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
    activeAgenciesService.isPrisonActive.mockResolvedValue(true)
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
    expect(response.text).toMatch(/<p>\s*<a href="#" class="govuk-link">Cancel this assessment<\/a>\s*<\/p>/)
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
    expect(response.text).toContain(`href="${assessmentUrl}/confirm-rating"`)
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
    expect(response.text).toMatch(new RegExp(`<p>\\s*<a class="govuk-link" href="${assessmentUrl}">Cancel</a>\\s*</p>`))
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

  it('uses zero-based step ids for confirmation change links and displays unanswered values explicitly', async () => {
    csraService.getCsraAssessment.mockResolvedValue(
      assessment({
        stages: [stageAnswers({ pncChecked: true, officerSpokeToPrisoner: true, likelyToHarmCellmate: false })],
      }),
    )

    const response = await request(buildApp([Role.CSRA__ASSESSMENT_EDIT]))
      .get(`${assessmentUrl}/confirm-rating`)
      .expect(200)
    const rows = response.text.match(/<div class="govuk-summary-list__row">[\s\S]*?<\/div>/g) ?? []

    for (const [sectionId, stepId, questionId, answer] of [
      ['evidenceAndOffences', 1, 'offenceMurderManslaughter', 'Not answered'],
      ['evidenceAndOffences', 1, 'offenceAssistingSuicide', 'Not answered'],
      ['evidenceAndOffences', 4, 'offenceSexualAssault', 'Not answered'],
      ['conversationAndVulnerability', 0, 'officerSpokeToPrisoner', 'Yes'],
      ['conversationAndVulnerability', 1, 'likelyToHarmCellmate', 'No'],
      ['conversationAndVulnerability', 2, 'significantlyVulnerable', 'Not answered'],
      ['observation', 0, 'causeForConcernSharing', 'Not answered'],
      ['otherRisks', 0, 'otherHighRiskIndicators', 'Not answered'],
      ['healthcare', 0, 'seenByHealthcare', 'Not answered'],
      ['healthcare', 1, 'healthcareIncreasedRisk', 'Not answered'],
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
})

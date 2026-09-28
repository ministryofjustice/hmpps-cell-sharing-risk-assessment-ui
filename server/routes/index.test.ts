import type { Express } from 'express'
import request from 'supertest'
import { appWithAllRoutes, flashProvider, user } from './testutils/appSetup'
import AuditService, { Page } from '../services/auditService'
import CsraService from '../services/csraService'
import PrisonerSearchService from '../services/prisonerSearchService'
import ManageUsersService from '../services/manageUsersService'
import PrisonApiService from '../services/prisonApiService'
import ActiveAgenciesService from '../services/activeAgenciesService'
import type { CsraCurrentRating, CsraReviewDetail, CsraReviewHistory, CsraReviewSummary } from '../data/csraApiTypes'
import type { Prisoner } from '../data/prisonerSearchApiTypes'
import { Role } from '../utils/roles'
import { NomisScreenNotSetUpError } from '../utils/nomisSplash'

jest.mock('../services/auditService')
jest.mock('../services/csraService')
jest.mock('../services/prisonerSearchService')
jest.mock('../services/manageUsersService')
jest.mock('../services/prisonApiService')
jest.mock('../services/activeAgenciesService')

const auditService = new AuditService(null) as jest.Mocked<AuditService>
const csraService = new CsraService(null) as jest.Mocked<CsraService>
const prisonerSearchService = new PrisonerSearchService(null) as jest.Mocked<PrisonerSearchService>
const manageUsersService = new ManageUsersService(null) as jest.Mocked<ManageUsersService>
const prisonApiService = new PrisonApiService(null, null) as jest.Mocked<PrisonApiService>
const activeAgenciesService = new ActiveAgenciesService(null) as jest.Mocked<ActiveAgenciesService>

const adminUser = { ...user, userRoles: [Role.CSRA__ADMIN] }

let app: Express

beforeEach(() => {
  // The prisoner fixtures below sit in LEI, which is in the user's caseloads, so the access guard
  // (checkPrisonerAccess) lets these requests through. Access rules are covered in
  // checkPrisonerAccess.test.ts.
  manageUsersService.getUserCaseloads.mockResolvedValue({
    username: 'user1',
    active: true,
    accountType: 'GENERAL',
    activeCaseload: { id: 'LEI', name: 'Leeds (HMP)' },
    caseloads: [{ id: 'LEI', name: 'Leeds (HMP)' }],
  })
  csraService.getRatingSummary.mockResolvedValue({
    prisonId: 'LEI',
    total: 1015,
    noRating: 0,
    highRisk: 217,
    standardRisk: 795,
  })
  app = appWithAllRoutes({
    services: {
      auditService,
      csraService,
      prisonerSearchService,
      manageUsersService,
      prisonApiService,
      activeAgenciesService,
    },
    userSupplier: () => user,
  })
})

/** The same app but signed in as a rollout admin, for the admin console tests. */
const adminApp = () =>
  appWithAllRoutes({
    services: {
      auditService,
      csraService,
      prisonerSearchService,
      manageUsersService,
      prisonApiService,
      activeAgenciesService,
    },
    userSupplier: () => adminUser,
  })

afterEach(() => {
  jest.resetAllMocks()
})

describe('GET /', () => {
  it('should render index page', () => {
    auditService.logPageView.mockResolvedValue(null)

    return request(app)
      .get('/')
      .expect('Content-Type', /html/)
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('Cell sharing risk assessment (CSRA)')
        expect(auditService.logPageView).toHaveBeenCalledWith(Page.INDEX, {
          who: user.username,
          correlationId: expect.any(String),
        })
      })
  })
})

describe('GET /prisoner/:prisonerNumber', () => {
  const prisoner: Prisoner = {
    prisonerNumber: 'A1234BC',
    firstName: 'JOHN',
    lastName: 'SMITH',
    prisonId: 'LEI',
    prisonName: 'Moorland (HMP)',
    cellLocation: 'A-1-001',
  }

  beforeEach(() => {
    auditService.logPageView.mockResolvedValue(null)
    prisonerSearchService.getPrisoner.mockResolvedValue(prisoner)
  })

  it('renders the current CSRA for a prisoner and audits the page view', () => {
    const csra: CsraCurrentRating = {
      prisonerNumber: 'A1234BC',
      status: 'COMPLETE',
      rating: 'HIGH_SPECIFIC',
      provisional: false,
      reviewId: 'de91dfa7-821f-4552-a427-bf2f32eafeb0',
      riskTo: [{ category: 'DIFFERENT_ETHNICITY', details: 'Racist towards other ethnicities.' }],
      vulnerabilities: [{ category: 'NEURODIVERSITY', details: null }],
      finalDate: '2026-07-01',
    }
    csraService.getCurrentRating.mockResolvedValue(csra)

    return request(app)
      .get('/prisoner/A1234BC')
      .expect('Content-Type', /html/)
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('John Smith')
        expect(res.text).toContain('A1234BC')
        expect(res.text).toContain('High risk – specific')
        expect(res.text).toContain('Different ethnicity')
        expect(res.text).toContain('Neurodiversity')
        expect(res.text).toContain('1 July 2026')
        expect(prisonerSearchService.getPrisoner).toHaveBeenCalledWith(user.username, 'A1234BC')
        expect(csraService.getCurrentRating).toHaveBeenCalledWith(user.username, 'A1234BC')
        expect(auditService.logPageView).toHaveBeenCalledWith(Page.PRISONER_CSRA, {
          who: user.username,
          subjectId: 'A1234BC',
          subjectType: 'PRISONER_ID',
          correlationId: expect.any(String),
        })
      })
  })

  it('shows a no-CSRA message when the prisoner has no current rating', () => {
    csraService.getCurrentRating.mockResolvedValue({
      prisonerNumber: 'A1234BC',
      status: 'NO_RATING',
      rating: null,
      provisional: false,
      riskTo: [],
      vulnerabilities: [],
    })

    return request(app)
      .get('/prisoner/A1234BC')
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('No rating')
        expect(res.text).toContain('This person requires an assessment.')
      })
  })
})

describe('GET /prisoner/:prisonerNumber/history', () => {
  const prisoner: Prisoner = {
    prisonerNumber: 'A1234BC',
    firstName: 'DANIEL',
    lastName: 'HAVERS',
    dateOfBirth: '1972-02-03',
    prisonId: 'LEI',
    pncNumber: '15/17564AG',
  }

  const history: CsraReviewHistory = {
    summary: {
      totalCsras: 13,
      highCount: 2,
      standardCount: 11,
      firstAssessmentDate: '2011-06-15',
      lastAssessmentDate: '2025-10-11',
      lastHighDate: '2013-07-14',
      ratings: ['HIGH', 'HIGH_SPECIFIC', 'STANDARD'],
      establishments: [],
    },
    content: [
      {
        id: 'de91dfa7-821f-4552-a427-bf2f32eafeb0',
        type: 'CSRA_REVIEW',
        assessmentType: 'REVIEW',
        rating: 'HIGH_SPECIFIC',
        reviewComment: 'Cannot share with specific groups.',
        recordedDate: '2024-07-23',
        finalRating: 'HIGH_SPECIFIC',
        finalReviewComment: 'Cannot share with specific groups.',
        finalRecordedDate: '2024-07-23',
        provisionalRating: null,
        provisionalRecordedDate: null,
        closureReason: null,
        riskTo: [],
        vulnerabilities: [],
        prisonId: 'LEI',
        prisonName: null,
      },
    ],
    page: 0,
    size: 10,
    totalElements: 13,
    totalPages: 2,
  }

  const entry = (overrides: Partial<CsraReviewSummary> = {}): CsraReviewSummary => ({
    id: 'de91dfa7-821f-4552-a427-bf2f32eafeb0',
    type: 'CSRA_INITIAL_ASSESSMENT',
    assessmentType: 'ASSESSMENT',
    rating: 'STANDARD',
    reviewComment: 'Final assessment notes.',
    recordedDate: '2025-10-11',
    finalRating: 'STANDARD',
    finalReviewComment: 'Final assessment notes.',
    finalRecordedDate: '2025-10-11',
    provisionalRating: null,
    provisionalRecordedDate: null,
    closureReason: null,
    riskTo: [],
    vulnerabilities: [],
    prisonId: 'LEI',
    prisonName: 'Leeds (HMP)',
    ...overrides,
  })

  const showEntry = (review: CsraReviewSummary) => {
    csraService.getHistory.mockResolvedValue({
      ...history,
      content: [review],
      totalElements: 1,
      totalPages: 1,
    })
    return request(app).get('/prisoner/A1234BC/history').expect(200)
  }

  const visibleText = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

  beforeEach(() => {
    auditService.logPageView.mockResolvedValue(null)
    prisonerSearchService.getPrisoner.mockResolvedValue(prisoner)
  })

  it('renders the history list, summary and banner, and audits the page view', () => {
    csraService.getHistory.mockResolvedValue(history)

    return request(app)
      .get('/prisoner/A1234BC/history')
      .expect('Content-Type', /html/)
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('CSRA history')
        expect(res.text).toContain('Daniel Havers')
        expect(res.text).toContain('15/17564AG') // PNC in the banner
        expect(res.text).toContain('3 February 1972') // DOB in the banner
        expect(res.text).toContain('HIGH RISK')
        expect(res.text).toContain('SPECIFIC')
        expect(res.text).toContain('Cannot share with specific groups.')
        expect(res.text).toContain('Assessed at LEI')
        expect(res.text).toContain('June 2011') // summary date range
        expect(res.text).toContain('Last high 14 July 2013')
        expect(res.text).toContain('13 CSRAs</strong>')
        expect(csraService.getHistory).toHaveBeenCalledWith(user.username, 'A1234BC', {
          page: '0',
          size: '10',
          ratings: undefined,
          establishments: undefined,
          fromDate: undefined,
          toDate: undefined,
        })
        expect(csraService.getHistory).toHaveBeenCalledTimes(1)
        expect(auditService.logPageView).toHaveBeenCalledWith(Page.PRISONER_CSRA_HISTORY, {
          who: user.username,
          subjectId: 'A1234BC',
          subjectType: 'PRISONER_ID',
          correlationId: expect.any(String),
        })
      })
  })

  it('passes whitelisted rating/establishment/date filters and the zero-based page to the service', () => {
    csraService.getHistory.mockResolvedValue(history)

    return request(app)
      .get('/prisoner/A1234BC/history?ratings=HIGH&ratings=BOGUS&establishments=lei&fromDate=1/1/2020&page=2')
      .expect(200)
      .expect(() => {
        expect(csraService.getHistory).toHaveBeenCalledWith(user.username, 'A1234BC', {
          page: '1',
          size: '10',
          ratings: ['HIGH'],
          establishments: ['LEI'],
          fromDate: '2020-01-01',
          toDate: undefined,
        })
      })
  })

  it('renders establishment checkboxes and resolves prison names when the summary supplies them', () => {
    csraService.getHistory.mockResolvedValue({
      ...history,
      summary: {
        ...history.summary,
        establishments: [
          { prisonId: 'HLI', prisonName: 'Hull (HMP)' },
          { prisonId: 'LEI', prisonName: 'Leeds (HMP)' },
        ],
      },
    })

    return request(app)
      .get('/prisoner/A1234BC/history')
      .expect(200)
      .expect(res => {
        // Establishment filter checkboxes
        expect(res.text).toContain('Hull (HMP)')
        expect(res.text).toContain('value="LEI"')
        // The provenance resolves the prison name instead of the raw id
        expect(res.text).toContain('Assessed at Leeds (HMP)')
        expect(res.text).not.toContain('Assessed at LEI')
      })
  })

  it('shows an empty message when the prisoner has no history', () => {
    csraService.getHistory.mockResolvedValue({
      summary: { ...history.summary, totalCsras: 0, highCount: 0, standardCount: 0 },
      content: [],
      page: 0,
      size: 10,
      totalElements: 0,
      totalPages: 0,
    })

    return request(app)
      .get('/prisoner/A1234BC/history')
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('There are no CSRA assessments or reviews for this prisoner.')
      })
  })

  it('returns 404 for an invalid prisoner number', () => {
    return request(app).get('/prisoner/not-a-number/history').expect(404)
  })

  it('keeps the originating worklist on the filter form, the links and the pagination', () => {
    csraService.getHistory.mockResolvedValue(history)

    return request(app)
      .get('/prisoner/A1234BC/history?from=due-for-review&ratings=HIGH&page=2')
      .expect(200)
      .expect(res => {
        // A GET form rebuilds the query string, so the origin has to be a field.
        expect(res.text).toContain('name="from" value="due-for-review"')
        expect(res.text).toContain('href="/prisoner/A1234BC/history?from=due-for-review"') // clear filters
        expect(res.text).toContain(
          'href="/prisoner/A1234BC/history/de91dfa7-821f-4552-a427-bf2f32eafeb0?from=due-for-review"',
        )
        // Pagination links come from the controller's base query params.
        expect(res.text).toContain('from=due-for-review&amp;ratings=HIGH&amp;page=')
      })
  })

  it('shows the breadcrumb, selected tab, identity banner, tiles, filter panel and both pagination controls to a user without CSRA roles', async () => {
    csraService.getHistory.mockResolvedValue(history)
    csraService.getCurrentRating.mockResolvedValue({
      prisonerNumber: 'A1234BC',
      status: 'NO_RATING',
      rating: null,
      provisional: false,
      riskTo: [],
      vulnerabilities: [],
    })
    const current = await request(app).get('/prisoner/A1234BC').expect(200)
    const response = await request(app).get('/prisoner/A1234BC/history').expect(200)
    const text = visibleText(response.text)
    expect(text).toContain('Digital Prison Services')
    expect(text).toContain('CSRA history')
    expect(response.text).toMatch(/<h1[^>]*>CSRA history<\/h1>/)
    expect(response.text).toMatch(/aria-current="page"[^>]*>CSRA history<\/a>/)
    expect(response.text.match(/class="csra-summary__card"/g)).toHaveLength(3)
    expect(response.text).toContain('data-qa="csra-filter-panel"')
    expect(response.text).toContain('data-qa="csra-history-entry"')
    expect(response.text.match(/data-qa="pagination"/g)).toHaveLength(2)
    expect(text).toContain('Showing 1 to 10 of 13 CSRAs')
    expect(response.text.match(/data-qa="prisoner-banner"[\s\S]*?<\/dl>/)?.[0]).toBe(
      current.text.match(/data-qa="prisoner-banner"[\s\S]*?<\/dl>/)?.[0],
    )
  })

  it('shows a single-month range, zero counts without a last-high hint, and hides pagination for one entry', async () => {
    csraService.getHistory.mockResolvedValue({
      ...history,
      summary: {
        ...history.summary,
        totalCsras: 1,
        highCount: 0,
        standardCount: 0,
        firstAssessmentDate: '2025-10-11',
        lastAssessmentDate: '2025-10-11',
        lastHighDate: null,
      },
      content: [entry()],
      totalElements: 1,
      totalPages: 1,
    })
    const response = await request(app).get('/prisoner/A1234BC/history').expect(200)
    const text = visibleText(response.text)
    expect(text).toContain('Total CSRAs 1 October 2025')
    expect(text).toContain('High ratings 0')
    expect(text).toContain('Standard ratings 0')
    expect(text).not.toContain('Last high')
    expect(response.text).not.toContain('data-qa="pagination"')
    expect(text).not.toContain('Showing 1 to')
  })

  it('keeps full-history tiles and options when filters return no results', async () => {
    csraService.getHistory.mockResolvedValue({
      ...history,
      content: [],
      totalElements: 0,
      totalPages: 0,
    })
    const response = await request(app).get('/prisoner/A1234BC/history?ratings=HIGH').expect(200)
    const text = visibleText(response.text)
    expect(text).toContain('Total CSRAs 13 June 2011 – October 2025')
    expect(text).toContain('High ratings 2 Last high 14 July 2013')
    expect(text).toContain('No history has been found for the selected filters.')
    for (const suggestion of [
      'different CSRA rating types',
      'different establishments',
      'different dates',
      'clear filters',
    ]) {
      expect(text).toContain(suggestion)
    }
    expect(response.text).toContain('data-qa="csra-filter-panel"')
    expect(response.text).not.toContain('data-qa="csra-history-entry"')
    expect(csraService.getHistory).toHaveBeenCalledTimes(1)
  })

  it('hides the summary, filters and results when there is no history', async () => {
    csraService.getHistory.mockResolvedValue({
      ...history,
      summary: { ...history.summary, totalCsras: 0, highCount: 0, standardCount: 0 },
      content: [],
      totalElements: 0,
      totalPages: 0,
    })
    const response = await request(app).get('/prisoner/A1234BC/history').expect(200)
    expect(response.text).toContain('There are no CSRA assessments or reviews for this prisoner.')
    for (const qa of ['csra-summary', 'csra-filters', 'csra-history-entry', 'pagination', 'no-results']) {
      expect(response.text).not.toContain(`data-qa="${qa}"`)
    }
  })

  it('renders final assessments with and without a separately dated provisional comment', async () => {
    const final = await showEntry(entry())
    expect(visibleText(final.text)).toContain(
      'Assessment STANDARD RISK View full assessment Assessment comment: Final assessment notes. Assessed at Leeds (HMP) 11 October 2025',
    )
    expect(final.text).not.toContain('Provisional assessment comment:')
    const staged = await showEntry(
      entry({
        provisionalRating: 'HIGH_GENERAL',
        provisionalReviewComment: 'Initial notes.',
        provisionalRecordedDate: '2025-10-09',
      }),
    )
    const text = visibleText(staged.text)
    expect(text).toContain('Assessment comment: Final assessment notes. Assessed at Leeds (HMP) 11 October 2025')
    expect(text).toContain('Provisional assessment comment: Initial notes. Assessed at Leeds (HMP) 9 October 2025')
  })

  it('uses the stage-specific fields instead of deprecated rating, comment and date fields', async () => {
    const response = await showEntry(
      entry({
        rating: 'HIGH',
        reviewComment: 'Outdated comment',
        recordedDate: '2020-01-01',
        finalRating: 'STANDARD',
        finalReviewComment: 'Current comment',
        finalRecordedDate: '2025-10-11',
      }),
    )
    const text = visibleText(response.text)
    expect(text).toContain('STANDARD RISK')
    expect(text).toContain('Current comment')
    expect(text).toContain('11 October 2025')
    expect(text).not.toContain('Outdated comment')
    expect(text).not.toContain('1 January 2020')
  })

  it('renders a provisional high-specific assessment with risk lists and its only comment', async () => {
    const response = await showEntry(
      entry({
        finalRating: null,
        finalRecordedDate: null,
        finalReviewComment: null,
        provisionalRating: 'HIGH_SPECIFIC',
        provisionalReviewComment: 'Initial notes.',
        provisionalRecordedDate: '2025-10-11',
        riskTo: [{ category: 'DIFFERENT_ETHNICITY', details: 'Threats' }],
        vulnerabilities: [{ category: 'NEURODIVERSITY' }],
      }),
    )
    const text = visibleText(response.text)
    expect(text).toContain('Provisional assessment HIGH RISK SPECIFIC (PROVISIONAL) View full provisional assessment')
    expect(text).toContain('Risk to: Different ethnicity — Threats')
    expect(text).toContain('Vulnerable due to: Neurodiversity')
    expect(text).toContain('Provisional assessment comment: Initial notes. Assessed at Leeds (HMP) 11 October 2025')
    expect(text).not.toContain('Assessment comment:')
  })

  it('renders reviews and interim reviews with the original comment labels and provenance', async () => {
    const review = await showEntry(
      entry({
        type: 'CSRA_REVIEW',
        assessmentType: 'REVIEW',
        finalReviewComment: 'Reviewed notes.',
      }),
    )
    expect(visibleText(review.text)).toContain(
      'Review STANDARD RISK View full review Review comment: Reviewed notes. Assessed at Leeds (HMP) 11 October 2025',
    )
    const interim = await showEntry(
      entry({
        type: 'CSRA_REVIEW',
        assessmentType: 'REVIEW',
        finalRating: null,
        finalRecordedDate: null,
        provisionalRating: 'HIGH_GENERAL',
        provisionalReviewComment: 'Urgent review.',
        provisionalRecordedDate: '2025-10-11',
      }),
    )
    expect(visibleText(interim.text)).toContain(
      'Review HIGH RISK GENERAL (INTERIM) Provisional review comment: Urgent review. Assessed at Leeds (HMP) 11 October 2025',
    )
    expect(interim.text).not.toContain('data-qa="view-full-link"')
  })

  it('shows risk and vulnerability details above the comment for a high-specific review', async () => {
    const response = await showEntry(
      entry({
        type: 'CSRA_REVIEW',
        assessmentType: 'REVIEW',
        finalRating: 'HIGH_SPECIFIC',
        finalReviewComment: 'Specific review notes.',
        riskTo: [{ category: 'GANG_MEMBERS', details: 'Named group' }],
        vulnerabilities: [{ category: 'MENTAL_HEALTH', details: 'Needs support' }],
      }),
    )
    const text = visibleText(response.text)
    expect(text).toContain('Risk to: Gang members — Named group')
    expect(text).toContain('Vulnerable due to: Mental health — Needs support')
    expect(text.indexOf('Risk to:')).toBeLessThan(text.indexOf('Review comment:'))
    expect(text.indexOf('Vulnerable due to:')).toBeLessThan(text.indexOf('Review comment:'))
  })

  it.each([
    ['ASSESSMENT', 'NOT_COMPLETED_PRISONER_TRANSFER', 'Full assessment not completed due to prisoner transfer.'],
    ['ASSESSMENT', 'NOT_COMPLETED_PRISONER_RELEASE', 'Full assessment not completed due to prisoner release.'],
    ['REVIEW', 'NOT_COMPLETED_PRISONER_TRANSFER', 'Review not completed due to prisoner transfer.'],
    ['REVIEW', 'NOT_COMPLETED_PRISONER_RELEASE', 'Review not completed due to prisoner release.'],
  ] as const)(
    'shows the closure reason above comments for %s on %s',
    async (assessmentType, closureReason, message) => {
      const response = await showEntry(
        entry({
          type: assessmentType === 'REVIEW' ? 'CSRA_REVIEW' : 'CSRA_INITIAL_ASSESSMENT',
          assessmentType,
          closureReason,
          rating: 'HIGH_GENERAL',
          reviewComment: 'Unfinished rating.',
          finalRating: null,
          finalRecordedDate: null,
          provisionalRating: 'HIGH_GENERAL',
          provisionalReviewComment: 'Unfinished rating.',
          provisionalRecordedDate: '2025-10-11',
        }),
      )
      const text = visibleText(response.text)
      expect(text).toContain(message)
      expect(text.indexOf(message)).toBeLessThan(
        text.indexOf(assessmentType === 'REVIEW' ? 'Provisional review comment:' : 'Provisional assessment comment:'),
      )
    },
  )

  it.each([
    ['HI', 'APPROVED', 'HIGH RISK', 'Approved'],
    ['STANDARD', 'APPROVED', 'STANDARD RISK', 'Approved'],
    ['LOW', 'NOT_APPROVED', 'Low risk', 'Not approved'],
    ['MED', 'APPROVED', 'Medium risk', 'Level changed at approval'],
  ] as const)('renders NOMIS %s with %s status', async (level, approvalStatus, ratingText, tagText) => {
    const response = await showEntry(
      entry({
        type: 'NOMIS_REVIEW',
        assessmentType: 'REVIEW',
        prisonId: null,
        prisonName: null,
        legacy: {
          level,
          approvalStatus,
          calculatedLevel: level === 'MED' ? 'LOW' : level,
          assessmentDate: '2011-06-15',
          approvalDate: '2011-06-17',
        },
      }),
    )
    const text = visibleText(response.text)
    expect(text).toContain(ratingText)
    expect(text).toContain(tagText)
    expect(text).toContain('View details')
    expect(text).toContain('No approval comment entered.')
    expect(text).toContain('No assessment comment entered.')
    expect(text).toContain('at an unknown establishment 17 June 2011')
    expect(text).toContain('at an unknown establishment 15 June 2011')
    if (level === 'LOW' || level === 'MED') {
      expect(response.text).toMatch(/<h2 class="govuk-heading-m">(?:Low|Medium) risk<\/h2>/)
    } else {
      expect(response.text).toContain('risk-badge')
    }
    const tagColor = approvalStatus === 'NOT_APPROVED' ? 'orange' : 'green'
    expect(response.text).toContain(`govuk-tag--${level === 'MED' ? 'blue' : tagColor}`)
  })

  it('does not invent an approval state or approval date for a NOMIS row with no approval', async () => {
    const response = await showEntry(
      entry({
        type: 'NOMIS_REVIEW',
        assessmentType: 'REVIEW',
        legacy: { level: 'HI', calculatedLevel: null, assessmentDate: '2011-06-15' },
      }),
    )
    expect(visibleText(response.text)).not.toContain('Approval comment:')
    expect(visibleText(response.text)).toContain('at Leeds (HMP) 15 June 2011')
    expect(response.text).not.toContain('data-qa="approval-state"')
    expect(visibleText(response.text)).not.toContain('Approved at')
  })

  it('does not badge a legacy assessment as provisional or show level changed without approval', async () => {
    const response = await showEntry(
      entry({
        type: 'FULL',
        assessmentType: 'ASSESSMENT',
        finalRating: null,
        finalRecordedDate: null,
        provisionalRating: 'HIGH_GENERAL',
        provisionalRecordedDate: '2011-06-15',
        legacy: {
          level: 'HI',
          calculatedLevel: 'LOW',
          approvalStatus: 'NOT_APPROVED',
          assessmentDate: '2011-06-15',
        },
      }),
    )
    const text = visibleText(response.text)
    expect(text).toContain('HIGH RISK')
    expect(text).toContain('Not approved')
    expect(text).not.toContain('(PROVISIONAL)')
    expect(text).not.toContain('Level changed at approval')
    expect(text).toContain('View details')
  })

  it('lists assessments, reviews and NOMIS entries together in API order, with a ten-result page and matching pagination windows', async () => {
    const entryTypes = ['CSRA_INITIAL_ASSESSMENT', 'CSRA_REVIEW', 'NOMIS_REVIEW'] as const
    csraService.getHistory.mockResolvedValue({
      ...history,
      content: Array.from({ length: 10 }, (_, index) =>
        entry({
          id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
          finalReviewComment: `History item ${index + 1}`,
          type: entryTypes[index] ?? entryTypes[0],
          assessmentType: index === 1 || index === 2 ? 'REVIEW' : 'ASSESSMENT',
          legacy:
            index === 2
              ? {
                  level: 'HI',
                  calculatedLevel: null,
                  assessmentDate: '2025-10-09',
                  assessmentComment: 'History item 3',
                }
              : undefined,
        }),
      ),
    })
    const first = await request(app).get('/prisoner/A1234BC/history').expect(200)
    expect(first.text.match(/data-qa="csra-history-entry"/g)).toHaveLength(10)
    expect(first.text.match(/data-qa="pagination"/g)).toHaveLength(2)
    expect(visibleText(first.text)).toContain('Showing 1 to 10 of 13 CSRAs')
    expect(first.text.indexOf('History item 1')).toBeLessThan(first.text.indexOf('History item 2'))
    expect(first.text.indexOf('History item 2')).toBeLessThan(first.text.indexOf('History item 3'))

    csraService.getHistory.mockResolvedValue({
      ...history,
      page: 1,
      content: [entry({ finalReviewComment: 'Page two result' })],
      totalElements: 13,
    })
    const second = await request(app).get('/prisoner/A1234BC/history?page=2').expect(200)
    expect(visibleText(second.text)).toContain('Showing 11 to 13 of 13 CSRAs')
    expect(second.text.match(/data-qa="pagination"/g)).toHaveLength(2)
    expect(csraService.getHistory).toHaveBeenLastCalledWith(
      user.username,
      'A1234BC',
      expect.objectContaining({ page: '1', size: '10' }),
    )
  })

  it('does not show pagination or a count for exactly ten entries', async () => {
    csraService.getHistory.mockResolvedValue({
      ...history,
      content: Array.from({ length: 10 }, (_, index) => entry({ id: `assessment-${index}` })),
      totalElements: 10,
      totalPages: 1,
    })
    const response = await request(app).get('/prisoner/A1234BC/history').expect(200)
    expect(response.text.match(/data-qa="csra-history-entry"/g)).toHaveLength(10)
    expect(response.text).not.toContain('data-qa="pagination"')
    expect(visibleText(response.text)).not.toContain('Showing 1 to')
  })

  it('offers only rating types and establishments present in the full history, with multi-selects and MoJ date pickers', async () => {
    csraService.getHistory.mockResolvedValue({
      ...history,
      summary: {
        ...history.summary,
        ratings: [
          'STANDARD',
          'HIGH_GENERAL',
          'HIGH_SPECIFIC',
          'HIGH_GENERAL_PROVISIONAL',
          'HIGH_SPECIFIC_PROVISIONAL',
          'HIGH_GENERAL_INTERIM',
          'HIGH',
          'STANDARD_LEGACY',
          'LOW',
          'MED',
          'PEND',
        ],
        establishments: [
          { prisonId: 'LEI', prisonName: 'Leeds (HMP)' },
          { prisonId: 'HLI', prisonName: 'Hull (HMP)' },
        ],
      },
    })
    const response = await request(app)
      .get('/prisoner/A1234BC/history?ratings=HIGH&ratings=LOW&establishments=LEI&establishments=HLI')
      .expect(200)
    const text = visibleText(response.text)
    for (const label of [
      'Standard risk',
      'High risk – general',
      'High risk – specific',
      'High risk – general (provisional)',
      'High risk – specific (provisional)',
      'High risk – general (interim)',
      'High risk',
      'Standard risk (legacy)',
      'Low',
      'Medium',
      'Pending',
      'Leeds (HMP)',
      'Hull (HMP)',
    ]) {
      expect(text).toContain(label)
    }
    expect(response.text).toMatch(/name="ratings"[^>]*value="HIGH" checked/)
    expect(response.text).toMatch(/name="ratings"[^>]*value="LOW" checked/)
    expect(response.text).toMatch(/name="establishments"[^>]*value="LEI" checked/)
    expect(response.text).toMatch(/name="establishments"[^>]*value="HLI" checked/)
    expect(response.text).toContain('data-module="moj-date-picker"')
    expect(response.text).toContain('name="fromDate"')
    expect(response.text).toContain('name="toDate"')
    expect(response.text).toContain('Apply')
    expect(response.text).toContain('Clear filters')
  })

  it.each([
    ['fromDate=1/1/2020', '2020-01-01', undefined],
    ['toDate=31/12/2024', undefined, '2024-12-31'],
    ['', undefined, undefined],
  ])('accepts an open-ended or empty date filter (%s)', async (query, fromDate, toDate) => {
    csraService.getHistory.mockResolvedValue(history)
    await request(app)
      .get(`/prisoner/A1234BC/history${query ? `?${query}` : ''}`)
      .expect(200)
    expect(csraService.getHistory).toHaveBeenLastCalledWith(
      user.username,
      'A1234BC',
      expect.objectContaining({ fromDate, toDate }),
    )
  })

  it('reports reversed dates, retains the entered values and does not apply the invalid filter', async () => {
    csraService.getHistory.mockResolvedValue(history)
    const response = await request(app)
      .get('/prisoner/A1234BC/history?ratings=HIGH&fromDate=2/1/2025&toDate=1/1/2025')
      .expect(200)
    expect(visibleText(response.text)).toContain('&#39;Date from&#39; must be on or before &#39;Date to&#39;')
    expect(response.text).toContain('value="2/1/2025"')
    expect(response.text).toContain('value="1/1/2025"')
    expect(csraService.getHistory).toHaveBeenLastCalledWith(user.username, 'A1234BC', { page: '0', size: '10' })
  })
})

describe('breadcrumbs', () => {
  const prisoner: Prisoner = {
    prisonerNumber: 'A1234BC',
    firstName: 'DANIEL',
    lastName: 'HAVERS',
    prisonId: 'LEI',
  }

  /** The breadcrumb nav only, so assertions cannot be satisfied by links elsewhere on the page. */
  const trail = (html: string) => html.match(/<nav class="govuk-breadcrumbs.*?<\/nav>/s)?.[0] ?? ''

  beforeEach(() => {
    auditService.logPageView.mockResolvedValue(null)
    prisonerSearchService.getPrisoner.mockResolvedValue(prisoner)
    csraService.getCurrentRating.mockResolvedValue({
      prisonerNumber: 'A1234BC',
      status: 'NO_RATING',
      rating: null,
      provisional: false,
      riskTo: [],
      vulnerabilities: [],
    })
  })

  it('ends at the prisoner on the current rating page, with no worklist', () => {
    return request(app)
      .get('/prisoner/A1234BC')
      .expect(200)
      .expect(res => {
        expect(trail(res.text)).toContain('Digital Prison Services')
        expect(trail(res.text)).toContain('CSRA')
        expect(trail(res.text)).toContain('Daniel Havers')
        expect(trail(res.text)).not.toContain('due-for-review')
      })
  })

  it('includes the worklist the prisoner was reached from', () => {
    return request(app)
      .get('/prisoner/A1234BC?from=due-for-review')
      .expect(200)
      .expect(res => {
        expect(trail(res.text)).toContain('href="/due-for-review"')
        expect(trail(res.text)).toContain('High risk prisoners due for review')
      })
  })

  it('links the prisoner crumb back to the current rating from the history page, keeping the worklist', () => {
    csraService.getHistory.mockResolvedValue({
      summary: {
        totalCsras: 0,
        highCount: 0,
        standardCount: 0,
        firstAssessmentDate: null,
        lastAssessmentDate: null,
        lastHighDate: null,
        ratings: [],
        establishments: [],
      },
      content: [],
      page: 0,
      size: 10,
      totalElements: 0,
      totalPages: 0,
    })

    return request(app)
      .get('/prisoner/A1234BC/history?from=due-for-review')
      .expect(200)
      .expect(res => {
        expect(trail(res.text)).toContain('High risk prisoners due for review')
        expect(trail(res.text)).toContain('aria-current="page">Daniel Havers')
      })
  })

  it('never renders an unrecognised origin', () => {
    return request(app)
      .get('/prisoner/A1234BC?from=https://evil.example/phish')
      .expect(200)
      .expect(res => {
        expect(res.text).not.toContain('evil.example')
      })
  })
})

describe('GET /prisoner/:prisonerNumber/history/:reviewId', () => {
  const reviewId = 'de91dfa7-821f-4552-a427-bf2f32eafeb0'

  const prisoner: Prisoner = {
    prisonerNumber: 'A1234BC',
    firstName: 'DANIEL',
    lastName: 'HAVERS',
    dateOfBirth: '1972-02-03',
    prisonId: 'LEI',
  }

  const legacyReview: CsraReviewDetail = {
    id: reviewId,
    prisonerNumber: 'A1234BC',
    prisonId: 'LEI',
    prisonName: 'Leeds (HMP)',
    assessmentDate: '2016-10-31',
    type: 'REVIEW',
    assessmentType: 'REVIEW',
    finalResult: 'HIGH',
    finalResultDate: '2016-10-31',
    createdAt: '2016-10-31T09:15:00',
    createdBy: 'NQP56Y',
    legacy: {
      level: 'HI',
      approvedResult: 'HI',
      calculatedResult: 'STANDARD',
      approvalCommitteeComment: 'Agreed at review board.',
      approvalCommittee: { code: 'REVIEW', name: 'Review Board' },
      approvalDate: '2016-11-02',
      assessmentComment: 'Previous violence towards cellmates.',
      assessmentCommittee: { code: 'RECP', name: 'Reception' },
      nextReviewDate: '2017-10-31',
      questions: [
        { question: 'Select Risk Rating', answer: 'High', additionalAnswers: [] },
        {
          question: 'Who is this person a risk to?',
          answer: 'Different ethnicity',
          additionalAnswers: ['Transgender'],
        },
        { question: 'Never answered', answer: null, additionalAnswers: [] },
      ],
    },
  }

  beforeEach(() => {
    auditService.logPageView.mockResolvedValue(null)
    prisonerSearchService.getPrisoner.mockResolvedValue(prisoner)
  })

  it('renders a legacy review with its detail and questions, and audits the page view', () => {
    csraService.getReview.mockResolvedValue(legacyReview)

    return request(app)
      .get(`/prisoner/A1234BC/history/${reviewId}`)
      .expect('Content-Type', /html/)
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('CSRA review on 31 October 2016')
        expect(res.text).toContain('Daniel Havers')
        expect(res.text).toContain('Approved result')
        expect(res.text).toContain('Agreed at review board.')
        expect(res.text).toContain('Review Board')
        expect(res.text).toContain('2 November 2016')
        expect(res.text).toContain('Previous violence towards cellmates.')
        expect(res.text).toContain('Leeds (HMP)')
        expect(res.text).toContain('Reception')
        expect(res.text).toContain('31 October 2017') // next review date
        // Questions, including the additional answer the legacy screen drops
        expect(res.text).toContain('Select Risk Rating')
        expect(res.text).toContain('Who is this person a risk to?')
        expect(res.text).toContain('Transgender')
        expect(res.text).not.toContain('Never answered')
        expect(csraService.getReview).toHaveBeenCalledWith(user.username, reviewId)
        expect(auditService.logPageView).toHaveBeenCalledWith(Page.PRISONER_CSRA_REVIEW, {
          who: user.username,
          subjectId: 'A1234BC',
          subjectType: 'PRISONER_ID',
          correlationId: expect.any(String),
          details: { reviewId },
        })
      })
  })

  it('never shows override rows, which are not in the migration contract', () => {
    csraService.getReview.mockResolvedValue(legacyReview)

    return request(app)
      .get(`/prisoner/A1234BC/history/${reviewId}`)
      .expect(200)
      .expect(res => {
        expect(res.text).not.toContain('Override result')
        expect(res.text).not.toContain('Override reason')
      })
  })

  it('tells the user the captured answers are not available for a DPS-created review', () => {
    csraService.getReview.mockResolvedValue({
      ...legacyReview,
      type: 'CSRA_INITIAL_ASSESSMENT',
      legacy: null,
    })

    return request(app)
      .get(`/prisoner/A1234BC/history/${reviewId}`)
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('CSRA initial assessment')
        expect(res.text).toContain('not available in this service yet')
        expect(res.text).not.toContain('Review questions')
      })
  })

  it('returns 404 when the API does not know the review', () => {
    csraService.getReview.mockRejectedValue({ responseStatus: 404 })

    return request(app).get(`/prisoner/A1234BC/history/${reviewId}`).expect(404)
  })

  it('returns 404 for a review id that is not a UUID, without calling the API', () => {
    return request(app)
      .get('/prisoner/A1234BC/history/not-a-uuid')
      .expect(404)
      .expect(() => {
        expect(csraService.getReview).not.toHaveBeenCalled()
      })
  })

  it('returns 404 for a review belonging to a different prisoner', () => {
    csraService.getReview.mockResolvedValue({ ...legacyReview, prisonerNumber: 'Z9999ZZ' })

    return request(app)
      .get(`/prisoner/A1234BC/history/${reviewId}`)
      .expect(404)
      .expect(() => {
        expect(auditService.logPageView).not.toHaveBeenCalled()
      })
  })
})

describe('Admin - manage enabled prisons', () => {
  const agencies = [
    { agencyId: 'LEI', name: 'Leeds (HMP)', active: false },
    { agencyId: 'MDI', name: 'Moorland (HMP)', active: true },
  ]

  beforeEach(() => {
    flashProvider.mockReturnValue([])
    csraService.getAllAgencies.mockResolvedValue(agencies)
    prisonApiService.getNomisScreenStates.mockResolvedValue(new Map())
    auditService.logPageView.mockResolvedValue(null)
    auditService.logAuditEvent.mockResolvedValue(null)
  })

  describe('GET /admin/prisons', () => {
    it('lists every prison with its DPS state and audits the page view', () => {
      return request(adminApp())
        .get('/admin/prisons')
        .expect('Content-Type', /html/)
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('Manage enabled prisons')
          expect(res.text).toContain('CSRA is switched on for 1 of 2 prisons.')
          expect(res.text).toContain('Leeds (HMP)')
          expect(res.text).toContain('Moorland (HMP)')
          expect(auditService.logPageView).toHaveBeenCalledWith(Page.ADMIN_PRISONS, {
            who: adminUser.username,
            correlationId: expect.any(String),
          })
        })
    })

    it('filters the list by the search term', () => {
      return request(adminApp())
        .get('/admin/prisons?q=leeds')
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('Leeds (HMP)')
          expect(res.text).not.toContain('Moorland (HMP)')
        })
    })

    it('tells the admin when no prison matches the search', () => {
      return request(adminApp())
        .get('/admin/prisons?q=nowhere')
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('No prisons match your search.')
        })
    })

    it('shows the NOMIS state and only the transitions the prison is not already in', () => {
      prisonApiService.getNomisScreenStates.mockResolvedValue(new Map([['MDI', 'BLOCKED']]))

      return request(adminApp())
        .get('/admin/prisons')
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('Blocked')
          expect(res.text).toContain('data-qa="nomis-warning-MDI"')
          expect(res.text).toContain('data-qa="nomis-clear-MDI"')
          expect(res.text).not.toContain('data-qa="nomis-block-MDI"')
        })
    })

    it('flags a prison whose NOMIS screens disagree, offering every state so it can be repaired', () => {
      prisonApiService.getNomisScreenStates.mockResolvedValue(new Map([['MDI', 'MIXED']]))

      return request(adminApp())
        .get('/admin/prisons')
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('Mixed')
          // None of the three states matches, so all are offered.
          expect(res.text).toContain('data-qa="nomis-warning-MDI"')
          expect(res.text).toContain('data-qa="nomis-block-MDI"')
          expect(res.text).toContain('data-qa="nomis-clear-MDI"')
        })
    })

    it('reports the NOMIS screen as unavailable and hides its controls when it cannot be read', () => {
      prisonApiService.getNomisScreenStates.mockResolvedValue(null)

      return request(adminApp())
        .get('/admin/prisons')
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('status is currently unavailable')
          expect(res.text).toContain('Unknown')
          expect(res.text).not.toContain('data-qa="nomis-block-MDI"')
        })
    })

    it('is forbidden for a user without the admin role', () => {
      return request(app)
        .get('/admin/prisons')
        .expect(403)
        .expect(res => {
          expect(res.text).toContain('Authorisation Error')
          expect(csraService.getAllAgencies).not.toHaveBeenCalled()
        })
    })
  })

  describe('POST /admin/prisons/:agencyId', () => {
    it('switches a prison on, drops the cached rollout state and redirects with a success flash', () => {
      csraService.setAgencyActive.mockResolvedValue({ agencyId: 'LEI', name: 'Leeds (HMP)', active: true })

      return request(adminApp())
        .post('/admin/prisons/LEI')
        .send({ active: 'true', name: 'Leeds (HMP)' })
        .expect(302)
        .expect('Location', '/admin/prisons')
        .expect(() => {
          expect(csraService.setAgencyActive).toHaveBeenCalledWith(adminUser.username, 'LEI', true)
          expect(activeAgenciesService.applyAgencyChange).toHaveBeenCalledWith('LEI', true)
          expect(flashProvider).toHaveBeenCalledWith('success', 'CSRA is now switched on for Leeds (HMP).')
          expect(auditService.logAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({ what: 'SET_PRISON_ACTIVE', subjectId: 'LEI', details: { active: true } }),
          )
        })
    })

    it('switches a prison off and keeps the admin on the same filtered view', () => {
      csraService.setAgencyActive.mockResolvedValue({ agencyId: 'MDI', name: 'Moorland (HMP)', active: false })

      return request(adminApp())
        .post('/admin/prisons/MDI')
        .send({ active: 'false', name: 'Moorland (HMP)', q: 'moor' })
        .expect(302)
        .expect('Location', '/admin/prisons?q=moor')
        .expect(() => {
          expect(csraService.setAgencyActive).toHaveBeenCalledWith(adminUser.username, 'MDI', false)
          expect(flashProvider).toHaveBeenCalledWith('success', 'CSRA is now switched off for Moorland (HMP).')
        })
    })

    it('is forbidden for a user without the admin role', () => {
      return request(app)
        .post('/admin/prisons/LEI')
        .send({ active: 'true' })
        .expect(403)
        .expect(() => {
          expect(csraService.setAgencyActive).not.toHaveBeenCalled()
        })
    })
  })

  describe('POST /admin/prisons/:agencyId/nomis-screen', () => {
    it('blocks the NOMIS screen and redirects with a success flash', () => {
      prisonApiService.setNomisScreenState.mockResolvedValue(undefined)

      return request(adminApp())
        .post('/admin/prisons/MDI/nomis-screen')
        .send({ state: 'BLOCKED', name: 'Moorland (HMP)' })
        .expect(302)
        .expect('Location', '/admin/prisons')
        .expect(() => {
          expect(prisonApiService.setNomisScreenState).toHaveBeenCalledWith(adminUser.username, 'MDI', 'BLOCKED')
          expect(flashProvider).toHaveBeenCalledWith('success', 'NOMIS CSRA access is now blocked for Moorland (HMP).')
          expect(auditService.logAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({ what: 'SET_NOMIS_CSRA_SCREEN', subjectId: 'MDI', details: { state: 'BLOCKED' } }),
          )
        })
    })

    it('rejects an unrecognised state without calling prison-api', () => {
      return request(adminApp())
        .post('/admin/prisons/MDI/nomis-screen')
        .send({ state: 'NONSENSE', name: 'Moorland (HMP)' })
        .expect(302)
        .expect(() => {
          expect(prisonApiService.setNomisScreenState).not.toHaveBeenCalled()
          expect(flashProvider).toHaveBeenCalledWith('error', 'Select a valid NOMIS CSRA screen state.')
        })
    })

    it('explains that the splash screen has not been set up in NOMIS yet', () => {
      prisonApiService.setNomisScreenState.mockRejectedValue(new NomisScreenNotSetUpError(['OIDCAPPR']))

      return request(adminApp())
        .post('/admin/prisons/MDI/nomis-screen')
        .send({ state: 'BLOCKED', name: 'Moorland (HMP)' })
        .expect(302)
        .expect(() => {
          expect(flashProvider).toHaveBeenCalledWith('error', expect.stringContaining('OIDCAPPR'))
          expect(auditService.logAuditEvent).not.toHaveBeenCalled()
        })
    })

    it('is forbidden for a user without the admin role', () => {
      return request(app)
        .post('/admin/prisons/MDI/nomis-screen')
        .send({ state: 'BLOCKED' })
        .expect(403)
        .expect(() => {
          expect(prisonApiService.setNomisScreenState).not.toHaveBeenCalled()
        })
    })
  })

  describe('the admin tile on the landing page', () => {
    beforeEach(() => {
      csraService.getRatingSummary.mockResolvedValue({
        prisonId: 'LEI',
        total: 10,
        noRating: 1,
        highRisk: 2,
        standardRisk: 7,
      })
    })

    it('is shown to an admin', () => {
      return request(adminApp())
        .get('/')
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('Manage enabled prisons')
          expect(res.text).toContain('/admin/prisons')
        })
    })

    it('is hidden from a user without the admin role', () => {
      return request(app)
        .get('/')
        .expect(200)
        .expect(res => {
          expect(res.text).not.toContain('/admin/prisons')
        })
    })
  })
})
